'use server';

import { revalidatePath } from 'next/cache';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { isChamadoStatus, janelaAberta } from '@/lib/chamados';
import { enviarTexto } from '@/lib/whatsapp';

const TAMANHO_MAXIMO_MENSAGEM = 4096;

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

/**
 * Responde o cliente pelo WhatsApp e registra a mensagem no histórico.
 *
 * A janela de 24 h é conferida aqui e não só na tela: entre carregar a lista e
 * clicar em enviar, ela pode ter fechado.
 */
export async function responderChamado(chamadoId: string, texto: string): Promise<ResultadoAcao> {
  const mensagem = texto.trim();
  if (mensagem === '') {
    return { erro: 'Escreva a mensagem antes de enviar.' };
  }
  if (mensagem.length > TAMANHO_MAXIMO_MENSAGEM) {
    return { erro: `A mensagem passa de ${TAMANHO_MAXIMO_MENSAGEM} caracteres.` };
  }

  const supabase = await criarClienteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) {
    return { erro: 'Sessão expirada. Entre novamente.' };
  }

  const { data: chamado, error: erroBusca } = await supabase
    .from('chamados')
    .select('id, telefone, recebido_em')
    .eq('id', chamadoId)
    .single();

  if (erroBusca || chamado === null) {
    return { erro: 'Chamado não encontrado.' };
  }

  if (!janelaAberta(chamado.recebido_em)) {
    return {
      erro: 'Passaram-se mais de 24 h desde a mensagem do cliente. '
        + 'O WhatsApp só aceita template aprovado nesse caso.',
    };
  }

  const { waMessageId, erro } = await enviarTexto(chamado.telefone, mensagem);

  // Grava mesmo quando falha: fica o registro da tentativa e do motivo.
  const { error: erroRegistro } = await supabase.from('chamado_mensagens').insert({
    chamado_id: chamado.id,
    direcao: 'saida',
    texto: mensagem,
    enviado_por: user.id,
    wa_message_id: waMessageId,
    erro,
  });

  if (erroRegistro) {
    console.error('mensagem enviada mas nao registrada', chamado.id, erroRegistro.message);
  }

  revalidatePath('/chamados');
  return { erro };
}
