-- Histórico de mensagens de cada chamado: o que o cliente mandou e o que foi respondido.

create table if not exists public.chamado_mensagens (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,

  direcao text not null check (direcao in ('entrada', 'saida')),
  texto text not null,

  -- Quem respondeu. Nulo nas mensagens de entrada e nas automáticas.
  enviado_por uuid references auth.users (id) on delete set null,

  -- ID da mensagem no WhatsApp, quando houver.
  wa_message_id text unique,
  erro text,

  created_at timestamptz not null default now()
);

create index if not exists chamado_mensagens_chamado_idx
  on public.chamado_mensagens (chamado_id, created_at);

alter table public.chamado_mensagens enable row level security;

drop policy if exists "mensagens: leitura por usuario autenticado" on public.chamado_mensagens;
create policy "mensagens: leitura por usuario autenticado"
  on public.chamado_mensagens for select
  to authenticated
  using (true);

drop policy if exists "mensagens: insercao por usuario autenticado" on public.chamado_mensagens;
create policy "mensagens: insercao por usuario autenticado"
  on public.chamado_mensagens for insert
  to authenticated
  with check (enviado_por = auth.uid());
