-- Tabela de chamados abertos pelo WhatsApp (guincho, autossocorro, transporte).

create sequence if not exists chamados_protocolo_seq;

create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique
    default 'CH-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('chamados_protocolo_seq')::text, 4, '0'),

  canal text not null default 'whatsapp',
  telefone text not null,
  nome_cliente text,

  tipo_servico text not null default 'outro'
    check (tipo_servico in ('guincho', 'autossocorro', 'transporte', 'outro')),
  descricao text,

  endereco_origem text,
  endereco_destino text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),

  veiculo text,
  placa text,

  status text not null default 'aberto'
    check (status in ('aberto', 'em_atendimento', 'concluido', 'cancelado')),

  -- ID da mensagem no provedor: garante idempotência nas retentativas do webhook.
  wa_message_id text not null unique,
  recebido_em timestamptz not null default now(),
  payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chamados_status_idx on public.chamados (status, recebido_em desc);
create index if not exists chamados_telefone_idx on public.chamados (telefone);
create index if not exists chamados_placa_idx on public.chamados (placa) where placa is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chamados_set_updated_at on public.chamados;
create trigger chamados_set_updated_at
  before update on public.chamados
  for each row execute function public.set_updated_at();

-- A Edge Function grava com a service role, que ignora RLS.
-- Sem policy para anon: ninguém lê a tabela com a chave pública.
alter table public.chamados enable row level security;

drop policy if exists "chamados: leitura por usuario autenticado" on public.chamados;
create policy "chamados: leitura por usuario autenticado"
  on public.chamados for select
  to authenticated
  using (true);

drop policy if exists "chamados: atualizacao por usuario autenticado" on public.chamados;
create policy "chamados: atualizacao por usuario autenticado"
  on public.chamados for update
  to authenticated
  using (true)
  with check (true);
