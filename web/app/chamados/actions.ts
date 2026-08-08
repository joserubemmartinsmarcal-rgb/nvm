'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { isChamadoStatus } from '@/lib/chamados';

export interface ResultadoAcao {
  erro: string | null;
}

/**
 * Muda o status de um chamado.
 *
 * O status vem do navegador, então é validado aqui mesmo com a lista conhecida —
 * o check constraint do banco é a segunda barreira, não a primeira.
 */
export async function atualizarStatus(id: string, status: string): Promise<ResultadoAcao> {
  if (!isChamadoStatus(status)) {
    return { erro: 'Status inválido.' };
  }

  const supabase = await criarClienteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) {
    return { erro: 'Sessão expirada. Entre novamente.' };
  }

  const { error } = await supabase
    .from('chamados')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('falha ao atualizar status do chamado', id, error.message);
    return { erro: 'Não foi possível salvar. Tente de novo.' };
  }

  revalidatePath('/chamados');
  return { erro: null };
}
