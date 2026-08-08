# Tela de chamados (Next.js App Router)

Aplicativo completo e pronto para publicar: login, lista dos chamados que a Edge
Function grava na tabela `chamados`, filtro por status, busca, troca de status e
resposta ao cliente pelo WhatsApp.

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
```

Também dá para copiar as pastas `app/` e `lib/` para dentro de um Next.js que já
exista (o `meu-tms`), mantendo a estrutura.

## Duas telas, um código

A lista se adapta ao aparelho:

- **Celular** — cartões (`chamado-card.tsx`). A tabela obrigava a rolar de lado
  e escondia justamente o status e o botão de responder, que é o que a equipe
  precisa no meio da rua.
- **Computador** — tabela, que aproveita a largura.

## Login

Usa Supabase Auth com email e senha. Não há tela de cadastro de propósito: os
usuários são criados por você no painel do Supabase, em
**Authentication → Users → Add user**. É uma ferramenta interna, não um site
público — ninguém deve conseguir se cadastrar sozinho.

## Dependências

```bash
npm install @supabase/supabase-js '@supabase/ssr@>=0.12' server-only
```

> **Não use `@supabase/ssr` 0.5.x.** A assinatura genérica daquela versão não
> bate com o `supabase-js` 2.x atual e o `.update()` da tabela degrada para
> `never`, quebrando a build com um erro de tipo difícil de ler. Validado na
> 0.12.4.

Requer **Next.js 15** (o `searchParams` da página é um `Promise`, como na 15).
Estilo em Tailwind, que o `create-next-app` já configura.

## Variáveis de ambiente

No `.env.local` do `meu-tms`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Para responder o cliente pelo TMS, também:

```
WHATSAPP_PHONE_NUMBER_ID=<id do número na WABA>
WHATSAPP_TOKEN=<token de acesso permanente>
WHATSAPP_API_VERSION=v21.0
```

Essas três **não** levam `NEXT_PUBLIC_`: são segredos de servidor. O
`lib/whatsapp.ts` importa `server-only`, então a build quebra se alguém tentar
usá-lo em componente de cliente.

A chave **anônima**, não a service role. A leitura é autorizada pela RLS da
tabela: a policy libera `select` para `authenticated`, então o app só enxerga os
chamados com um usuário logado. A service role ignora RLS e deve ficar só na
Edge Function.

## Autenticação

O código assume **Supabase Auth**: `page.tsx` chama `supabase.auth.getUser()` e
redireciona para `/login` quando não há sessão, e o `middleware.ts` renova o
token a cada request.

Se o TMS for usar **NextAuth** em vez disso, dois pontos mudam: a autorização
deixa de vir da RLS (passaria a ser service role + checagem no app), e o
`middleware.ts` fica desnecessário. Vale decidir isso antes de crescer a tela.

## O que a tela faz

- **Filtro por status** em abas, com contagem por status. O filtro vai na URL
  (`/chamados?status=aberto`), então não há estado de cliente e o link é
  compartilhável.
- **Busca** por protocolo, nome, telefone ou placa.
- **Troca de status** direto na linha, com atualização otimista — a tarja muda
  na hora e volta ao valor anterior se o servidor recusar.
- **Telefone** vira link `wa.me`, para responder o cliente em um clique.
- **Localização** compartilhada vira link do Google Maps.
- **Idade do chamado** ("há 12 min") ao lado da data, que é o que importa no
  plantão.
- **Responder o cliente** sem sair da tela, com o histórico gravado em
  `chamado_mensagens` — inclusive as tentativas que falharam, com o motivo.

### A janela de 24 horas

O WhatsApp só aceita texto livre dentro de **24 h contadas da última mensagem
do cliente**; fora disso, exige template aprovado pela Meta. A tela mostra
quanto falta para fechar e desabilita o envio quando fecha, e a server action
confere de novo antes de mandar — entre carregar a lista e clicar em enviar, a
janela pode ter fechado.

Enquanto não houver templates aprovados, chamado parado por mais de um dia só
pode ser retomado por telefone.

Ordena por `recebido_em` desc e traz no máximo 200 linhas. Passando disso, o
próximo passo é paginação.

## Detalhes que não são óbvios

- `export const dynamic = 'force-dynamic'` — chamado novo pode chegar a qualquer
  momento; com cache a lista aparece velha.
- Os filtros (`eq`, `or`) precisam vir **antes** de `order`/`limit`: depois deles
  o builder do PostgREST já não expõe esses métodos.
- A lista de colunas do `select` é um **literal único**. Concatenar strings apaga
  o tipo literal e o `supabase-js` perde a tipagem das colunas.
- `Chamado` e `Database` são `type`, não `interface`. O postgrest-js exige que as
  linhas sejam atribuíveis a `Record<string, unknown>`, e `interface` não ganha
  index signature implícita.
- O status recebido pela server action é validado contra a lista conhecida antes
  de ir ao banco — o check constraint é a segunda barreira, não a primeira.

## Verificação

`tsc --noEmit` e `next build` passam em um projeto Next.js 15.5 real, com
`@supabase/ssr` 0.12.4 e `supabase-js` 2.112.2. A rota sai como dinâmica (`ƒ`),
que é o esperado.
