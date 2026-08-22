import { StatusSelect } from './status-select';
import { Responder } from './responder';
import { LinkLocal } from './link-local';
import {
  type Chamado,
  formatarData,
  formatarTelefone,
  horasRestantes,
  tempoDecorrido,
  TIPO_LABEL,
} from '@/lib/chamados';

/**
 * Versão em cartão, para celular.
 *
 * A tabela obriga a rolar de lado no telefone, escondendo justamente o status
 * e o botão de responder — que é o que a equipe precisa no meio da rua.
 */
export function ChamadoCard({ chamado }: { chamado: Chamado }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">{chamado.protocolo}</p>
          <p className="text-base font-semibold text-slate-900">
            {chamado.nome_cliente ?? 'Sem nome'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-600">
            {tempoDecorrido(chamado.recebido_em)}
          </p>
          <p className="text-xs text-slate-400">{formatarData(chamado.recebido_em)}</p>
        </div>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-slate-500">Serviço</dt>
          <dd className="text-slate-900">
            {TIPO_LABEL[chamado.tipo_servico]}
            {chamado.descricao !== null && (
              <span className="block text-slate-500">{chamado.descricao}</span>
            )}
          </dd>
        </div>

        {(chamado.veiculo !== null || chamado.placa !== null) && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500">Veículo</dt>
            <dd className="text-slate-900">
              {chamado.veiculo}
              {chamado.placa !== null && (
                <span className="ml-2 font-mono text-xs text-slate-500">{chamado.placa}</span>
              )}
            </dd>
          </div>
        )}

        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-slate-500">Local</dt>
          <dd className="text-slate-900">
            <LinkLocal chamado={chamado} />
            {chamado.endereco_destino !== null && (
              <span className="block text-slate-500">→ {chamado.endereco_destino}</span>
            )}
          </dd>
        </div>

        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-slate-500">Telefone</dt>
          <dd>
            <a
              href={`https://wa.me/${chamado.telefone}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline underline-offset-2"
            >
              {formatarTelefone(chamado.telefone)}
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <StatusSelect chamadoId={chamado.id} status={chamado.status} />
        <Responder
          chamadoId={chamado.id}
          protocolo={chamado.protocolo}
          nomeCliente={chamado.nome_cliente}
          horasRestantes={horasRestantes(chamado.recebido_em)}
        />
      </div>
    </article>
  );
}
