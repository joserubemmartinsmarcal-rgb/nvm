/** Tipos e rótulos da tabela `chamados`, compartilhados entre servidor e cliente. */

export const STATUS = ['aberto', 'em_atendimento', 'concluido', 'cancelado'] as const;
export type ChamadoStatus = (typeof STATUS)[number];

export const TIPOS = ['guincho', 'autossocorro', 'transporte', 'outro'] as const;
export type TipoServico = (typeof TIPOS)[number];

// `type` e não `interface`: o postgrest-js exige que as linhas sejam
// atribuíveis a `Record<string, unknown>`, e interface não ganha index
// signature implícita — com interface, o `update()` degrada para `never`.
export type Chamado = {
  id: string;
  protocolo: string;
  canal: string;
  telefone: string;
  nome_cliente: string | null;
  tipo_servico: TipoServico;
  descricao: string | null;
  endereco_origem: string | null;
  endereco_destino: string | null;
  latitude: number | null;
  longitude: number | null;
  veiculo: string | null;
  placa: string | null;
  status: ChamadoStatus;
  recebido_em: string;
};

export const STATUS_LABEL: Record<ChamadoStatus, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const TIPO_LABEL: Record<TipoServico, string> = {
  guincho: 'Guincho',
  autossocorro: 'Autossocorro',
  transporte: 'Transporte',
  outro: 'Outro',
};

/** Cores das tarjas de status. Aberto é o que precisa de ação, então puxa a atenção. */
export const STATUS_CLASSE: Record<ChamadoStatus, string> = {
  aberto: 'bg-amber-100 text-amber-900 ring-amber-300',
  em_atendimento: 'bg-blue-100 text-blue-900 ring-blue-300',
  concluido: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  cancelado: 'bg-slate-100 text-slate-600 ring-slate-300',
};

export function isChamadoStatus(valor: unknown): valor is ChamadoStatus {
  return typeof valor === 'string' && (STATUS as readonly string[]).includes(valor);
}

const FORMATADOR_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function formatarData(iso: string): string {
  return FORMATADOR_DATA.format(new Date(iso));
}

/** "há 5 min" / "há 2 h" — o que importa no plantão é a idade do chamado. */
export function tempoDecorrido(iso: string, agora: number = Date.now()): string {
  const minutos = Math.floor((agora - new Date(iso).getTime()) / 60000);
  if (minutos < 1) {
    return 'agora';
  }
  if (minutos < 60) {
    return `há ${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return `há ${horas} h`;
  }
  return `há ${Math.floor(horas / 24)} d`;
}

/**
 * Janela de atendimento do WhatsApp: 24 horas contadas da última mensagem do
 * cliente. Fora dela a Meta recusa texto livre e só aceita template aprovado.
 *
 * Lógica pura de propósito — a tela precisa dela para desabilitar o botão e o
 * servidor para recusar o envio.
 */
export const JANELA_HORAS = 24;

function fimDaJanela(ultimaMensagemDoCliente: string): number {
  return new Date(ultimaMensagemDoCliente).getTime() + JANELA_HORAS * 3600_000;
}

export function janelaAberta(ultimaMensagemDoCliente: string, agora: number = Date.now()): boolean {
  return agora < fimDaJanela(ultimaMensagemDoCliente);
}

/** Horas que faltam para a janela fechar, arredondadas para cima. 0 = fechada. */
export function horasRestantes(ultimaMensagemDoCliente: string, agora: number = Date.now()): number {
  return Math.max(0, Math.ceil((fimDaJanela(ultimaMensagemDoCliente) - agora) / 3600_000));
}

/** Formata o telefone do WhatsApp (5511988887777) como (11) 98888-7777. */
export function formatarTelefone(telefone: string): string {
  const nacional = telefone.startsWith('55') ? telefone.slice(2) : telefone;
  const match = nacional.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  return match === null ? telefone : `(${match[1]}) ${match[2]}-${match[3]}`;
}
