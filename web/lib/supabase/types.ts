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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
