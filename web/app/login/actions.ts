'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { criarClienteSupabase } from '@/lib/supabase/server';

export interface EstadoLogin {
  erro: string | null;
}

export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim();
  const senha = String(formData.get('senha') ?? '');

  if (email === '' || senha === '') {
    return { erro: 'Preencha o email e a senha.' };
  }

  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    // A mensagem da Supabase é em inglês e entrega se o email existe ou não.
    console.error('falha no login:', error.message);
    return { erro: 'Email ou senha incorretos.' };
  }

  revalidatePath('/', 'layout');
  // `redirect` lança para desviar o fluxo, então fica fora de qualquer try/catch.
  redirect('/chamados');
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
