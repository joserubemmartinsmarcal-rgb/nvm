import Link from 'next/link';
import { redirect } from 'next/navigation';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { StatusSelect } from './status-select';
import { Responder } from './responder';
import {
  type Chamado,
  formatarData,
  formatarTelefone,
  horasRestantes,
  isChamadoStatus,
  STATUS,
  STATUS_LABEL,
  tempoDecorrido,
  TIPO_LABEL,
} from '@/lib/chamados';

// Chamado novo pode chegar a qualquer momento: nada de cache.
export const dynamic = 'force-dynamic';

// Precisa ser um literal único: concatenar strings apaga o tipo literal e o
// supabase-js perde a tipagem das colunas. `payload` fica de fora de propósito.
const COLUNAS =
  'id, protocolo, canal, telefone, nome_cliente, tipo_servico, descricao, endereco_origem, endereco_destino, latitude, longitude, veiculo, placa, status, recebido_em';

interface Props {
  searchParams: Promise<{ status?: string; busca?: string }>;
}

/** Aba de filtro. Mantém a busca atual ao trocar de status. */
function AbaStatus(
  { rotulo, ativo, href, contagem }: {
    rotulo: string;
    ativo: boolean;
    href: string;
    contagem: number | null;
  },
) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        ativo ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
      }`}
    >
      {rotulo}
      {contagem !== null && (
        <span className={`ml-1.5 ${ativo ? 'text-slate-300' : 'text-slate-400'}`}>{contagem}</span>
      )}
    </Link>
  );
}

function LinkLocal({ chamado }: { chamado: Chamado }) {
  const { endereco_origem: origem, latitude, longitude } = chamado;
  if (latitude !== null && longitude !== null) {
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="text-blue-700 underline underline-offset-2"
      >
        {origem ?? 'Ver no mapa'}
      </a>
    );
  }
  return <>{origem ?? <span className="text-slate-400">—</span>}</>;
}

export default async function ChamadosPage({ searchParams }: Props) {
  const { status: statusParam, busca } = await searchParams;
  const statusFiltro = isChamadoStatus(statusParam) ? statusParam : null;
  const termo = busca?.trim() ?? '';

  const supabase = await criarClienteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) {
    redirect('/login');
  }

  // Os filtros precisam vir antes de `order`/`limit`: depois deles o builder
  // do PostgREST já não aceita `eq`/`or`.
  let filtro = supabase.from('chamados').select(COLUNAS);

  if (statusFiltro !== null) {
    filtro = filtro.eq('status', statusFiltro);
  }
  if (termo !== '') {
    // `%` e `,` quebram a sintaxe do filtro `or` do PostgREST.
    const seguro = termo.replace(/[%,]/g, ' ');
    filtro = filtro.or(
      `protocolo.ilike.%${seguro}%,nome_cliente.ilike.%${seguro}%,` +
        `telefone.ilike.%${seguro}%,placa.ilike.%${seguro}%`,
    );
  }

  const [{ data, error }, contagens] = await Promise.all([
    filtro.order('recebido_em', { ascending: false }).limit(200),
    Promise.all(
      STATUS.map(async (valor) => {
        const { count } = await supabase
          .from('chamados')
          .select('id', { count: 'exact', head: true })
          .eq('status', valor);
        return [valor, count ?? 0] as const;
      }),
    ),
  ]);

  const porStatus = Object.fromEntries(contagens);
  const chamados: Chamado[] = data ?? [];

  function hrefFiltro(valor: string | null): string {
    const params = new URLSearchParams();
    if (valor !== null) {
      params.set('status', valor);
    }
    if (termo !== '') {
      params.set('busca', termo);
    }
    const query = params.toString();
    return query === '' ? '/chamados' : `/chamados?${query}`;
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Chamados</h1>
        <p className="text-sm text-slate-500">
          {porStatus.aberto} aberto(s) · {porStatus.em_atendimento} em atendimento
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AbaStatus
          rotulo="Todos"
          ativo={statusFiltro === null}
          href={hrefFiltro(null)}
          contagem={null}
        />
        {STATUS.map((valor) => (
          <AbaStatus
            key={valor}
            rotulo={STATUS_LABEL[valor]}
            ativo={statusFiltro === valor}
            href={hrefFiltro(valor)}
            contagem={porStatus[valor]}
          />
        ))}

        <form className="ml-auto flex gap-2" action="/chamados">
          {statusFiltro !== null && <input type="hidden" name="status" value={statusFiltro} />}
          <input
            type="search"
            name="busca"
            defaultValue={termo}
            placeholder="Protocolo, nome, telefone ou placa"
            aria-label="Buscar chamados"
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Buscar
          </button>
        </form>
      </div>

      {error !== null && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar os chamados. Recarregue a página.
        </p>
      )}

      {error === null && chamados.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          {termo === '' && statusFiltro === null
            ? 'Nenhum chamado ainda. Assim que chegar mensagem no WhatsApp, ela aparece aqui.'
            : 'Nenhum chamado encontrado com esse filtro.'}
        </p>
      )}

      {chamados.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[64rem] border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Protocolo</th>
                <th scope="col" className="px-4 py-3 font-medium">Recebido</th>
                <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
                <th scope="col" className="px-4 py-3 font-medium">Serviço</th>
                <th scope="col" className="px-4 py-3 font-medium">Veículo</th>
                <th scope="col" className="px-4 py-3 font-medium">Origem / Destino</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {chamados.map((chamado) => (
                <tr key={chamado.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-900">
                    {chamado.protocolo}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    <div>{formatarData(chamado.recebido_em)}</div>
                    <div className="text-xs text-slate-400">
                      {tempoDecorrido(chamado.recebido_em)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {chamado.nome_cliente ?? 'Sem nome'}
                    </div>
                    <a
                      href={`https://wa.me/${chamado.telefone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-700 underline underline-offset-2"
                    >
                      {formatarTelefone(chamado.telefone)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{TIPO_LABEL[chamado.tipo_servico]}</div>
                    {chamado.descricao !== null && (
                      <div className="mt-0.5 max-w-xs text-xs text-slate-500">
                        {chamado.descricao}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{chamado.veiculo ?? <span className="text-slate-400">—</span>}</div>
                    {chamado.placa !== null && (
                      <div className="font-mono text-xs text-slate-500">{chamado.placa}</div>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-700">
                    <div><LinkLocal chamado={chamado} /></div>
                    {chamado.endereco_destino !== null && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        → {chamado.endereco_destino}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      <StatusSelect chamadoId={chamado.id} status={chamado.status} />
                      <Responder
                        chamadoId={chamado.id}
                        protocolo={chamado.protocolo}
                        nomeCliente={chamado.nome_cliente}
                        horasRestantes={horasRestantes(chamado.recebido_em)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
