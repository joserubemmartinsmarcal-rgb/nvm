'use client';

import { useActionState } from 'react';
import { entrar, type EstadoLogin } from './actions';

const ESTADO_INICIAL: EstadoLogin = { erro: null };

export function LoginForm() {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Senha</span>
        <input
          type="password"
          name="senha"
          required
          autoComplete="current-password"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-base"
        />
      </label>

      {estado.erro !== null && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{estado.erro}</p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {pendente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
