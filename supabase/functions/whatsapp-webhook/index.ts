/**
 * Edge Function: recebe o webhook do WhatsApp, extrai os dados do chamado
 * e insere na tabela `chamados`.
 *
 * GET  -> handshake de verificação da Meta (hub.challenge).
 * POST -> evento de mensagem; valida a assinatura, normaliza e grava.
 */

import { createClient } from '@supabase/supabase-js';
import { buildChamado, extractInboundMessages } from './parser.ts';

/** Lido a cada chamada (e não no import) para a função ser testável. */
function env(name: string): string {
  return Deno.env.get(name) ?? '';
}

const encoder = new TextEncoder();

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Comparação em tempo constante, para não vazar a assinatura esperada. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** HMAC-SHA256 do corpo, no formato do header da Meta (`sha256=<hex>`). */
export async function signBody(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return `sha256=${toHex(signature)}`;
}

/**
 * Confere o header `X-Hub-Signature-256` contra o HMAC do corpo cru.
 * O corpo precisa ser exatamente o recebido — reserializar o JSON quebra a assinatura.
 */
async function isValidSignature(rawBody: string, header: string | null): Promise<boolean> {
  if (header === null || !header.startsWith('sha256=')) {
    return false;
  }
  return timingSafeEqual(await signBody(rawBody, env('WHATSAPP_APP_SECRET')), header);
}

/** Handshake da Meta: devolve o `hub.challenge` em texto puro quando o token bate. */
function handleVerification(url: URL): Response {
  const verifyToken = env('WHATSAPP_VERIFY_TOKEN');
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && verifyToken !== '' && token === verifyToken) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return json(403, { error: 'verify_token invalido' });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return handleVerification(new URL(req.url));
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'metodo nao suportado' });
  }

  const rawBody = await req.text();

  // `WHATSAPP_ALLOW_UNSIGNED` dispensa a assinatura — só para desenvolvimento local.
  if (env('WHATSAPP_ALLOW_UNSIGNED') !== 'true') {
    if (env('WHATSAPP_APP_SECRET') === '') {
      console.error('WHATSAPP_APP_SECRET nao configurado');
      return json(500, { error: 'assinatura nao configurada' });
    }
    if (!await isValidSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
      console.warn('assinatura invalida — evento descartado');
      return json(401, { error: 'assinatura invalida' });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Corpo inválido nunca vai melhorar em uma retentativa: encerra com 200.
    console.warn('corpo nao e JSON valido');
    return json(200, { ignorado: 'payload invalido' });
  }

  const messages = extractInboundMessages(payload);
  if (messages.length === 0) {
    // Recibos de entrega/leitura e outros eventos caem aqui.
    return json(200, { ignorado: 'nenhuma mensagem de entrada' });
  }

  const chamados = messages.map(buildChamado);
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // `wa_message_id` é único: a retentativa do provedor não duplica o chamado.
  const { data, error } = await supabase
    .from('chamados')
    .upsert(chamados, { onConflict: 'wa_message_id', ignoreDuplicates: true })
    .select('id, protocolo, wa_message_id');

  if (error) {
    console.error('falha ao inserir chamados:', error.message);
    // 500 faz o provedor reenviar o evento — a mensagem não se perde.
    return json(500, { error: 'falha ao gravar chamado' });
  }

  const inseridos = data ?? [];
  console.log(
    `mensagens=${messages.length} chamados_novos=${inseridos.length} ` +
      `duplicados=${messages.length - inseridos.length}`,
  );

  return json(200, { recebidos: messages.length, chamados: inseridos });
}

// `import.meta.main` é falso quando o arquivo é importado por um teste.
if (import.meta.main) {
  Deno.serve(handleRequest);
}
