// ARQUIVO GERADO por bundle.sh — nao edite a mao.
// Edite parser.ts / index.ts e rode: sh bundle.sh
//
// Versao de arquivo unico da funcao, para colar no editor do painel
// do Supabase. O comportamento e identico ao dos arquivos separados.

import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Normalização de payloads de webhook do WhatsApp e extração dos dados do chamado.
 *
 * Suporta o formato da Meta WhatsApp Cloud API (padrão) e, como fallback,
 * o formato "plano" usado por gateways brasileiros (Z-API, Evolution API).
 */

export interface InboundMessage {
  /** ID único da mensagem no provedor — usado para idempotência. */
  id: string;
  /** Telefone do remetente, somente dígitos (ex.: 5511999998888). */
  from: string;
  /** Nome do perfil do WhatsApp, quando o provedor envia. */
  profileName: string | null;
  /** Momento do envio, em ISO 8601. */
  timestamp: string;
  /** Corpo textual da mensagem (texto, legenda, botão ou lista). */
  text: string | null;
  location: { latitude: number; longitude: number; address: string | null } | null;
  raw: unknown;
}

export interface ChamadoInput {
  wa_message_id: string;
  canal: string;
  telefone: string;
  nome_cliente: string | null;
  tipo_servico: string;
  descricao: string | null;
  endereco_origem: string | null;
  endereco_destino: string | null;
  latitude: number | null;
  longitude: number | null;
  veiculo: string | null;
  placa: string | null;
  recebido_em: string;
  payload: unknown;
}

/** Remove acentos e coloca em minúsculas, para casar rótulos escritos de qualquer jeito. */
function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Converte o timestamp do provedor (segundos, ms ou ISO) para ISO 8601. */
function toIsoTimestamp(value: unknown): string {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const numeric = Number(value);
    // A Meta envia segundos; gateways às vezes enviam milissegundos.
    const millis = numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;

function asRecord(value: unknown): AnyRecord | null {
  return typeof value === 'object' && value !== null ? value as AnyRecord : null;
}

/** Extrai o texto de uma mensagem da Cloud API, qualquer que seja o tipo. */
function metaMessageText(message: AnyRecord): string | null {
  switch (message.type) {
    case 'text':
      return trimToNull(message.text?.body);
    case 'button':
      return trimToNull(message.button?.text);
    case 'interactive':
      return trimToNull(
        message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title,
      );
    case 'image':
    case 'video':
    case 'document':
    case 'audio':
      return trimToNull(message[message.type]?.caption);
    default:
      return trimToNull(message.text?.body);
  }
}

/**
 * Converte o corpo do webhook em uma lista de mensagens recebidas.
 *
 * Eventos que não são mensagens de entrada — notavelmente os `statuses`
 * (entregue/lido), que a Meta dispara o tempo todo — retornam lista vazia,
 * para que nenhum chamado seja aberto por engano.
 */
export function extractInboundMessages(payload: unknown): InboundMessage[] {
  const body = asRecord(payload);
  if (body === null) {
    return [];
  }

  const messages: InboundMessage[] = [];

  // Formato Meta WhatsApp Cloud API.
  if (Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      const changes = asRecord(entry)?.changes;
      if (!Array.isArray(changes)) {
        continue;
      }
      for (const change of changes) {
        const value = asRecord(asRecord(change)?.value);
        if (value === null || !Array.isArray(value.messages)) {
          continue;
        }
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        for (const rawMessage of value.messages) {
          const message = asRecord(rawMessage);
          if (message === null || typeof message.id !== 'string') {
            continue;
          }
          const contact = asRecord(
            contacts.find((item: unknown) => asRecord(item)?.wa_id === message.from),
          );
          const location = asRecord(message.location);
          messages.push({
            id: message.id,
            from: digitsOnly(String(message.from ?? '')),
            profileName: trimToNull(contact?.profile?.name),
            timestamp: toIsoTimestamp(message.timestamp),
            text: metaMessageText(message),
            location: location === null ? null : {
              latitude: Number(location.latitude),
              longitude: Number(location.longitude),
              address: trimToNull(location.address ?? location.name),
            },
            raw: rawMessage,
          });
        }
      }
    }
    return messages;
  }

  // Fallback: gateways com payload plano (Z-API, Evolution API e similares).
  const id = body.messageId ?? body.id ?? body.key?.id;
  const from = body.phone ?? body.from ?? body.sender ?? body.key?.remoteJid;
  if (typeof id === 'string' && typeof from === 'string' && body.fromMe !== true) {
    const flatLocation = asRecord(body.location ?? body.message?.locationMessage);
    messages.push({
      id,
      from: digitsOnly(from.split('@')[0]),
      profileName: trimToNull(body.senderName ?? body.pushName ?? body.notifyName),
      timestamp: toIsoTimestamp(body.momment ?? body.timestamp ?? body.messageTimestamp),
      text: trimToNull(
        body.text?.message ?? body.message?.conversation ?? body.body ?? body.text,
      ),
      location: flatLocation === null ? null : {
        latitude: Number(flatLocation.latitude ?? flatLocation.degreesLatitude),
        longitude: Number(flatLocation.longitude ?? flatLocation.degreesLongitude),
        address: trimToNull(flatLocation.address ?? flatLocation.name),
      },
      raw: payload,
    });
  }

  return messages;
}

/** Rótulos aceitos para cada campo do chamado, em texto sem acento e minúsculo. */
const FIELD_LABELS: Record<string, string[]> = {
  nome: ['nome', 'cliente', 'nome do cliente', 'solicitante', 'contato nome'],
  telefone: ['telefone', 'tel', 'fone', 'celular', 'whatsapp', 'contato'],
  tipo: ['tipo', 'servico', 'tipo de servico', 'atendimento'],
  veiculo: ['veiculo', 'carro', 'modelo', 'moto'],
  placa: ['placa'],
  origem: ['local', 'origem', 'endereco', 'onde', 'local de origem', 'retirada', 'coleta'],
  destino: ['destino', 'entrega', 'levar para', 'destino final'],
  descricao: [
    'obs',
    'observacao',
    'observacoes',
    'descricao',
    'problema',
    'ocorrencia',
    'detalhes',
    'motivo',
  ],
};

const LABEL_TO_FIELD = new Map<string, string>();
for (const [field, labels] of Object.entries(FIELD_LABELS)) {
  for (const label of labels) {
    LABEL_TO_FIELD.set(label, field);
  }
}

// Placa Mercosul (ABC1D23) ou modelo antigo (ABC-1234 / ABC1234).
const PLACA_PATTERN = /\b([A-Z]{3}[ -]?\d[A-Z]\d{2}|[A-Z]{3}[ -]?\d{4})\b/;

const TIPO_KEYWORDS: Array<[string, RegExp]> = [
  ['guincho', /\b(guincho|reboque|rebocar|guinchar|plataforma)\b/],
  ['autossocorro', /\b(pane|bateria|chaveiro|pneu|estepe|combustivel|gasolina|socorro|arranca)\b/],
  ['transporte', /\b(frete|carga|transporte|mudanca|entrega|coleta)\b/],
];

function inferTipoServico(text: string): string {
  const normalized = normalizeLabel(text);
  for (const [tipo, pattern] of TIPO_KEYWORDS) {
    if (pattern.test(normalized)) {
      return tipo;
    }
  }
  return 'outro';
}

/**
 * Lê o texto da mensagem em pares `Rótulo: valor` (um por linha).
 * Linhas que não seguem esse formato viram descrição livre.
 */
function parseLabeledFields(text: string): { fields: Map<string, string>; leftover: string } {
  const fields = new Map<string, string>();
  const leftover: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*\*?([\p{L}\s]{2,30}?)\*?\s*[:\-–]\s*(.+)$/u);
    const field = match === null ? undefined : LABEL_TO_FIELD.get(normalizeLabel(match[1]));
    if (match !== null && field !== undefined) {
      const value = trimToNull(match[2]);
      // O primeiro valor vence, para uma mensagem que repete o mesmo rótulo.
      if (value !== null && !fields.has(field)) {
        fields.set(field, value);
      }
    } else if (trimToNull(line) !== null) {
      leftover.push(line.trim());
    }
  }

  return { fields, leftover: leftover.join('\n') };
}

/** Monta a linha da tabela `chamados` a partir de uma mensagem recebida. */
export function buildChamado(message: InboundMessage): ChamadoInput {
  const text = message.text ?? '';
  const { fields, leftover } = parseLabeledFields(text);

  const placaMatch = (fields.get('placa') ?? text).toUpperCase().match(PLACA_PATTERN);
  const telefoneInformado = fields.get('telefone');
  const telefoneNormalizado = telefoneInformado === undefined
    ? null
    : trimToNull(digitsOnly(telefoneInformado));

  // Sem rótulo de origem, a localização compartilhada serve como endereço.
  const origem = fields.get('origem') ?? message.location?.address ?? null;

  // Sem rótulo de descrição, sobra o texto livre. A mensagem inteira só entra
  // quando nada foi rotulado — senão a descrição repetiria os demais campos.
  const descricao = fields.get('descricao')
    ?? trimToNull(leftover)
    ?? (fields.size === 0 ? trimToNull(text) : null);

  return {
    wa_message_id: message.id,
    canal: 'whatsapp',
    telefone: telefoneNormalizado ?? message.from,
    nome_cliente: fields.get('nome') ?? message.profileName,
    tipo_servico: inferTipoServico(fields.get('tipo') ?? text),
    descricao,
    endereco_origem: origem,
    endereco_destino: fields.get('destino') ?? null,
    latitude: message.location?.latitude ?? null,
    longitude: message.location?.longitude ?? null,
    veiculo: fields.get('veiculo') ?? null,
    placa: placaMatch === null ? null : placaMatch[1].replace(/[ -]/g, ''),
    recebido_em: message.timestamp,
    payload: message.raw,
  };
}

/**
 * Edge Function: recebe o webhook do WhatsApp, extrai os dados do chamado
 * e insere na tabela `chamados`.
 *
 * GET  -> handshake de verificação da Meta (hub.challenge).
 * POST -> evento de mensagem; valida a assinatura, normaliza e grava.
 */


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
