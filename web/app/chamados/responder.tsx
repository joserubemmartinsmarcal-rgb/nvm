'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { responderChamado } from './actions';

interface Props {
  chamadoId: string;
  protocolo: string;
  nomeCliente: string | null;
  /** Horas que faltam para a janela de 24 h fechar; 0 = já fechada. */
  horasRestantes: number;
}

export function Responder({ chamadoId, protocolo, nomeCliente, horasRestantes }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  const janelaFechada = horasRestantes <= 0;

  // Fecha sozinho depois do aviso de enviado, para não travar a lista.
  useEffect(() => {
    if (!enviada) {
      return;
    }
    const id = setTimeout(() => {
      dialogo.current?.close();
      setEnviada(false);
      setTexto('');
    }, 1200);
    return () => clearTimeout(id);
  }, [enviada]);

  function enviar() {
    setErro(null);
    iniciarTransicao(async () => {
      const { erro: falha } = await responderChamado(chamadoId, texto);
      if (falha === null) {
        setEnviada(true);
      } else {
        setErro(falha);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        Responder
      </button>

      <dialog
        ref={dialogo}
        onClose={() => {
          setErro(null);
          setEnviada(false);
        }}
        className="w-[32rem] max-w-[90vw] rounded-xl p-0 backdrop:bg-slate-900/40"
      >
        <div className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Responder {nomeCliente ?? 'cliente'}
            </h2>
            <p className="font-mono text-xs text-slate-500">{protocolo}</p>
          </div>

          {janelaFechada
            ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Passaram-se mais de 24 h desde a mensagem do cliente. O WhatsApp não permite mais
                texto livre nesta conversa — só um template aprovado pela Meta.
              </p>
            )
            : (
              <p className="text-xs text-slate-500">
                A janela de resposta fecha em {horasRestantes} h.
              </p>
            )}

          <textarea
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            disabled={janelaFechada || pendente}
            rows={4}
            maxLength={4096}
            placeholder="Ex.: Recebemos seu chamado, o guincho sai em 15 minutos."
            aria-label="Mensagem para o cliente"
            className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm disabled:bg-slate-50"
          />

          {erro !== null && (
            <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{erro}</p>
          )}
          {enviada && (
            <p className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-800">
              Mensagem enviada.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={janelaFechada || pendente || texto.trim() === ''}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {pendente ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
