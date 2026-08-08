# Tela de chamados (Next.js App Router)

Lista os chamados que a Edge Function grava na tabela `chamados`, com filtro por
status, busca e troca de status na própria lista.

Estes arquivos foram escritos para serem **copiados para dentro do `meu-tms`**,
mantendo a estrutura de pastas:

```
web/app/chamados/page.tsx          ->  meu-tms/app/chamados/page.tsx
web/app/chamados/actions.ts        ->  meu-tms/app/chamados/actions.ts
web/app/chamados/status-select.tsx ->  meu-tms/app/chamados/status-select.tsx
web/lib/chamados.ts                ->  meu-tms/lib/chamados.ts
web/lib/supabase/server.ts         ->  meu-tms/lib/supabase/server.ts
web/lib/supabase/types.ts          ->  meu-tms/lib/supabase/types.ts
web/middleware.ts                  ->  meu-tms/middleware.ts
```

## Dependências

```bash
npm install @supabase/supabase-js '@supabase/ssr@>=0.12'
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
