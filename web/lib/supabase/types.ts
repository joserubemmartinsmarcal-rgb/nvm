import type { Chamado } from '@/lib/chamados';

/**
 * Tipagem do banco para o cliente Supabase.
 *
 * Escrita à mão para cobrir só o que o app usa. Quando o schema crescer, vale
 * trocar por `supabase gen types typescript --linked > lib/supabase/types.ts`.
 */

type ChamadoRow = Chamado & {
  payload: unknown;
  created_at: string;
  updated_at: string;
};

/** Colunas com default no banco (id, protocolo, status, datas) são opcionais. */
type ChamadoInsert =
  & Omit<ChamadoRow, 'id' | 'protocolo' | 'status' | 'created_at' | 'updated_at' | 'canal'>
  & Partial<Pick<ChamadoRow, 'id' | 'protocolo' | 'status' | 'canal'>>;

export type MensagemRow = {
  id: string;
  chamado_id: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  enviado_por: string | null;
  wa_message_id: string | null;
  erro: string | null;
  created_at: string;
};

/**
 * `enviado_por` é opcional: sem login no app, não há usuário a registrar.
 * A coluna aceita nulo justamente para as mensagens automáticas.
 */
type MensagemInsert =
  & Omit<MensagemRow, 'id' | 'created_at' | 'enviado_por'>
  & Partial<Pick<MensagemRow, 'id' | 'created_at' | 'enviado_por'>>;

// `type` e não `interface`: o postgrest-js checa o schema contra
// `Record<string, ...>`, e interface não ganha index signature implícita.
export type Database = {
  public: {
    Tables: {
      chamados: {
        Row: ChamadoRow;
        Insert: ChamadoInsert;
        Update: Partial<ChamadoRow>;
        Relationships: [];
      };
      chamado_mensagens: {
        Row: MensagemRow;
        Insert: MensagemInsert;
        Update: Partial<MensagemRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
