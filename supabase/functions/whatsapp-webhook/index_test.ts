import { assertEquals } from '@std/assert';
import { handleRequest, signBody } from './index.ts';

const URL_BASE = 'https://projeto.supabase.co/functions/v1/whatsapp-webhook';
const SECRET = 'segredo-de-teste';

function setup(vars: Record<string, string>) {
  const nomes = [
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_ALLOW_UNSIGNED',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  for (const nome of nomes) {
    Deno.env.delete(nome);
  }
  for (const [nome, valor] of Object.entries(vars)) {
    Deno.env.set(nome, valor);
  }
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request(URL_BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

/** Payload de status (entregue/lido): passa pela assinatura e para antes do banco. */
const STATUS_BODY = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ field: 'messages', value: { statuses: [{ status: 'delivered' }] } }] }],
});

Deno.test('GET com verify_token correto devolve o challenge', async () => {
  setup({ WHATSAPP_VERIFY_TOKEN: 'token-secreto' });
  const url = `${URL_BASE}?hub.mode=subscribe&hub.verify_token=token-secreto&hub.challenge=12345`;
  const res = await handleRequest(new Request(url));

  assertEquals(res.status, 200);
  assertEquals(res.headers.get('content-type'), 'text/plain');
  assertEquals(await res.text(), '12345');
});

Deno.test('GET com verify_token errado é rejeitado', async () => {
  setup({ WHATSAPP_VERIFY_TOKEN: 'token-secreto' });
  const url = `${URL_BASE}?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=12345`;
  const res = await handleRequest(new Request(url));

  assertEquals(res.status, 403);
  await res.body?.cancel();
});

Deno.test('GET nao vaza o challenge quando o verify_token nao foi configurado', async () => {
  setup({});
  const url = `${URL_BASE}?hub.mode=subscribe&hub.verify_token=&hub.challenge=12345`;
  const res = await handleRequest(new Request(url));

  assertEquals(res.status, 403);
  await res.body?.cancel();
});

Deno.test('POST sem assinatura é rejeitado', async () => {
  setup({ WHATSAPP_APP_SECRET: SECRET });
  const res = await handleRequest(post(STATUS_BODY));

  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test('POST com assinatura de outro corpo é rejeitado', async () => {
  setup({ WHATSAPP_APP_SECRET: SECRET });
  const assinaturaDeOutroCorpo = await signBody('{"outro":"corpo"}', SECRET);
  const res = await handleRequest(
    post(STATUS_BODY, { 'x-hub-signature-256': assinaturaDeOutroCorpo }),
  );

  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test('POST com assinatura de outro segredo é rejeitado', async () => {
  setup({ WHATSAPP_APP_SECRET: SECRET });
  const assinaturaErrada = await signBody(STATUS_BODY, 'segredo-errado');
  const res = await handleRequest(post(STATUS_BODY, { 'x-hub-signature-256': assinaturaErrada }));

  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test('POST com assinatura valida passa e ignora evento de status', async () => {
  setup({ WHATSAPP_APP_SECRET: SECRET });
  const assinatura = await signBody(STATUS_BODY, SECRET);
  const res = await handleRequest(post(STATUS_BODY, { 'x-hub-signature-256': assinatura }));

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ignorado: 'nenhuma mensagem de entrada' });
});

Deno.test('sem APP_SECRET configurado a funcao falha fechada', async () => {
  setup({});
  const res = await handleRequest(post(STATUS_BODY));

  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'assinatura nao configurada' });
});

Deno.test('ALLOW_UNSIGNED dispensa a assinatura no ambiente local', async () => {
  setup({ WHATSAPP_ALLOW_UNSIGNED: 'true' });
  const res = await handleRequest(post(STATUS_BODY));

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ignorado: 'nenhuma mensagem de entrada' });
});

Deno.test('corpo que nao e JSON nao gera retentativa', async () => {
  setup({ WHATSAPP_ALLOW_UNSIGNED: 'true' });
  const res = await handleRequest(post('nao sou json'));

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ignorado: 'payload invalido' });
});

Deno.test('metodo nao suportado devolve 405', async () => {
  setup({ WHATSAPP_ALLOW_UNSIGNED: 'true' });
  const res = await handleRequest(new Request(URL_BASE, { method: 'DELETE' }));

  assertEquals(res.status, 405);
  await res.body?.cancel();
});
