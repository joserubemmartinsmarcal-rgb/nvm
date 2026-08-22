import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Cliente Supabase do servidor, com a service role.
 *
 * Não há mais login de usuário no app: quem controla o acesso é a senha do
 * site, na frente. Por isso a leitura passa a ser feita pelo servidor com a
 * service role, e a RLS continua barrando qualquer acesso direto ao banco —
 * a chave anônima sozinha não enxerga nada.
 *
 * Este módulo é `server-only`: se algum dia for importado por um componente de
 * cliente, a build quebra em vez de vazar a chave para o navegador.
 */
export async function criarClienteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no servidor.',
    );
  }

  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
