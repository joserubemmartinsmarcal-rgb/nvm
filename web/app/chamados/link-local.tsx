import type { Chamado } from '@/lib/chamados';

/** Endereço de origem. Vira link do Maps quando o cliente mandou a localização. */
export function LinkLocal({ chamado }: { chamado: Chamado }) {
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
