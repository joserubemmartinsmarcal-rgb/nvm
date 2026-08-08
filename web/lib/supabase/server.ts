import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

/**
 * Cliente Supabase para Server Components e Server Actions.
 *
 * Usa a chave anônima e a sessão do usuário logado — a RLS da tabela `chamados`
 * é que autoriza a leitura. A service role não entra aqui: ela ignora RLS e só
 * deve viver na Edge Function, nunca no app.
 */
export async function criarClienteSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie; o middleware renova a sessão.
          }
        },
      },
    },
  );
}
