'use client';

import { useState, useTransition } from 'react';
import { atualizarStatus } from './actions';
import { STATUS, STATUS_CLASSE, STATUS_LABEL, type ChamadoStatus } from '@/lib/chamados';

interface Props {
  chamadoId: string;
  status: ChamadoStatus;
}

/** Tarja de status que também troca o status, sem sair da lista. */
export function StatusSelect({ chamadoId, status }: Props) {
  const [pendente, iniciarTransicao] = useTransition();
  // Mostra o novo status na hora; se o servidor recusar, volta ao anterior.
  const [otimista, setOtimista] = useState(status);
  const [erro, setErro] = useState<string | null>(null);

  const valorExibido = pendente ? otimista : status;

  function aoMudar(novo: string) {
    if (!STATUS.includes(novo as ChamadoStatus) || novo === status) {
      return;
    }
    setOtimista(novo as ChamadoStatus);
    setErro(null);
    iniciarTransicao(async () => {
      const { erro: falha } = await atualizarStatus(chamadoId, novo);
      if (falha !== null) {
        setOtimista(status);
        setErro(falha);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Status do chamado"
        value={valorExibido}
        disabled={pendente}
        onChange={(evento) => aoMudar(evento.target.value)}
        className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
          STATUS_CLASSE[valorExibido]
        } ${pendente ? 'opacity-60' : 'cursor-pointer'}`}
      >
        {STATUS.map((valor) => (
          <option key={valor} value={valor}>
            {STATUS_LABEL[valor]}
          </option>
        ))}
      </select>
      {erro !== null && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
