# Tela de chamados (Next.js App Router)

Aplicativo completo e publicado: lista dos chamados que a Edge Function grava na
tabela `chamados`, filtro por status, busca, troca de status e resposta ao
cliente pelo WhatsApp.

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

## Acesso

**Não há login nem senha.** Quem tiver o link do site vê os chamados —
inclusive nome, telefone e endereço dos clientes. A proteção real está em
**não divulgar o link**: mande só para quem precisa usar.

A leitura do banco é feita no servidor com a chave `service_role`; a RLS
continua barrando qualquer acesso direto ao banco de fora do servidor.

Duas tentativas de controle de acesso (login por usuário via Supabase Auth,
depois uma senha única do site) travaram na prática e foram removidas — a
prioridade passou a ser o sistema funcionar. Se o acesso por link aberto virar
um problema real, uma opção mais simples é a proteção por senha da própria
Vercel (Settings → Deployment Protection → Password Protection), que exige
plano pago mas não depende de código nenhum aqui.

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
- Alterar variável de ambiente na Vercel exige **republicar**; só salvar não
  basta.
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
`supabase-js` 2.112.2. A rota `/chamados` sai como dinâmica (`ƒ`), que é o
esperado, e não existem mais rotas de login nem middleware.
