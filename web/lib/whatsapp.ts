/** Envio de mensagem pela Cloud API da Meta. Só roda no servidor. */

import 'server-only';

const VERSAO_API = process.env.WHATSAPP_API_VERSION ?? 'v21.0';

export interface ResultadoEnvio {
  waMessageId: string | null;
  erro: string | null;
}

/**
 * Manda um texto para o cliente.
 *
 * Devolve o erro em vez de lançar: quem chama grava a tentativa no histórico
 * de qualquer jeito, para não sumir mensagem que a operação achou que enviou.
 */
export async function enviarTexto(telefone: string, texto: string): Promise<ResultadoEnvio> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    return { waMessageId: null, erro: 'WhatsApp não configurado no servidor.' };
  }

  let resposta: Response;
  try {
    resposta = await fetch(`https://graph.facebook.com/${VERSAO_API}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: telefone,
        type: 'text',
        text: { preview_url: false, body: texto },
      }),
    });
  } catch (causa) {
    console.error('falha de rede ao enviar mensagem', causa);
    return { waMessageId: null, erro: 'Sem conexão com o WhatsApp. Tente de novo.' };
  }

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    // A mensagem da Meta é técnica e em inglês; fica no log, não na tela.
    const detalhe = corpo?.error?.message ?? `HTTP ${resposta.status}`;
    console.error('WhatsApp recusou a mensagem:', detalhe);
    return {
      waMessageId: null,
      erro: resposta.status === 401 || resposta.status === 403
        ? 'Token do WhatsApp inválido ou vencido.'
        : 'O WhatsApp recusou a mensagem. Confira o log do servidor.',
    };
  }

  return { waMessageId: corpo?.messages?.[0]?.id ?? null, erro: null };
}
