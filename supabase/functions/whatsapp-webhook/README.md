# Edge Function: `whatsapp-webhook`

Recebe o webhook do WhatsApp, extrai os dados do chamado e insere na tabela `chamados`.

| Arquivo | Papel |
| --- | --- |
| `index.ts` | Handler HTTP: verificação, assinatura, gravação |
| `parser.ts` | Normaliza o payload do provedor e monta a linha do chamado |
| `parser_test.ts` | Testes do parser (`deno test`) |
| `index_test.ts` | Testes do handler: handshake, assinatura, respostas |
| `../../migrations/20260808120000_create_chamados.sql` | Tabela `chamados` |

## Como funciona

**`GET`** — handshake da Meta. Responde o `hub.challenge` em texto puro quando
`hub.verify_token` bate com `WHATSAPP_VERIFY_TOKEN`; caso contrário, `403`.

**`POST`** — evento de mensagem:

1. Lê o corpo **cru** e valida o header `X-Hub-Signature-256`
   (HMAC-SHA256 com o `WHATSAPP_APP_SECRET`, comparação em tempo constante).
   Assinatura inválida → `401`, nada é gravado.
2. Normaliza o payload em mensagens de entrada. Eventos de `statuses`
   (entregue/lido) e mensagens enviadas por você são descartados — sem eles,
   cada confirmação de leitura viraria um chamado.
3. Extrai os campos e faz `upsert` em `chamados` com `onConflict: wa_message_id`
   e `ignoreDuplicates`. Como o provedor reenvia o evento quando não recebe
   `200`, isso evita chamado duplicado.
4. Responde `200` (com os chamados criados), ou `500` em falha de banco —
   o `500` é proposital: faz o provedor reenviar em vez de perder a mensagem.

Provedores suportados: **Meta WhatsApp Cloud API** (principal) e, como fallback,
gateways de payload plano tipo **Z-API / Evolution API**. A validação de
assinatura implementada é a da Meta; usando outro gateway, ajuste
`isValidSignature` para o esquema dele.

## Formato da mensagem

Aceita `Rótulo: valor`, um por linha (acento e maiúscula são indiferentes):

```
Nome: João da Silva
Telefone: (11) 98888-7777
Tipo: guincho
Veículo: Fiat Uno 2012
Placa: ABC1D23
Local: Av. Paulista, 1000 - São Paulo
Destino: Oficina do Zé, Santo André
Obs: carro não liga
```

Rótulos reconhecidos (com sinônimos em `FIELD_LABELS`): `nome`, `telefone`,
`tipo`, `veículo`, `placa`, `local`/`origem`, `destino`, `obs`/`descrição`.

Sem rótulo nenhum, a mensagem inteira vira `descricao` e o resto é inferido:

- `tipo_servico` por palavra-chave — guincho/reboque → `guincho`;
  pane/bateria/chaveiro/pneu → `autossocorro`; frete/carga/mudança → `transporte`
- `placa` por regex (Mercosul `ABC1D23` e antiga `ABC-1234`)
- `nome_cliente` cai no nome do perfil do WhatsApp
- `telefone` cai no número do remetente

Se o cliente compartilhar a **localização**, `latitude`/`longitude` são gravadas
e o endereço vira `endereco_origem`.

## Deploy

```bash
# 1. Criar a tabela
supabase db push

# 2. Configurar os segredos
supabase secrets set WHATSAPP_VERIFY_TOKEN='um-token-que-voce-inventa'
supabase secrets set WHATSAPP_APP_SECRET='app-secret-do-painel-da-meta'

# 3. Publicar (sem JWT: quem chama é a Meta, não um usuário logado)
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetadas pela plataforma —
não precisa configurar, e a service role é o que permite gravar com a RLS ligada.

> `--no-verify-jwt` desliga a autenticação de usuário do Supabase, não a
> segurança da função: a proteção aqui é a assinatura HMAC, que é obrigatória.

Depois, em **Meta > WhatsApp > Configuration > Webhook**, cadastre a URL
`https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, informe o
mesmo verify token e assine o campo `messages`.

## Variáveis de ambiente

| Nome | Obrigatória | Para que serve |
| --- | --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | sim | Handshake `GET` da Meta |
| `WHATSAPP_APP_SECRET` | sim | Valida o `X-Hub-Signature-256` |
| `WHATSAPP_ALLOW_UNSIGNED` | não | `true` dispensa a assinatura — **só em dev local** |
| `SUPABASE_URL` | automática | Injetada pela plataforma |
| `SUPABASE_SERVICE_ROLE_KEY` | automática | Injetada pela plataforma |

## Desenvolvimento local

```bash
# Testes (não precisam de banco nem de rede)
deno test --allow-env supabase/functions/whatsapp-webhook/

# Servir a função localmente
supabase functions serve whatsapp-webhook --no-verify-jwt --env-file ./supabase/.env.local
```

Com `WHATSAPP_ALLOW_UNSIGNED=true` no `.env.local`, dá para simular um chamado:

```bash
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H 'content-type: application/json' \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{ "changes": [{ "field": "messages", "value": {
      "contacts": [{ "profile": { "name": "João" }, "wa_id": "5511999998888" }],
      "messages": [{
        "from": "5511999998888", "id": "wamid.TESTE1", "timestamp": "1754654400",
        "type": "text", "text": { "body": "Preciso de guincho na Av. Paulista, placa ABC1D23" }
      }]
    }}]}]
  }'
```

Repetir o mesmo `curl` deve responder `"chamados": []` — a idempotência por
`wa_message_id` funcionando.
