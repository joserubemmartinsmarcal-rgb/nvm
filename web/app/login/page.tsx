import { redirect } from 'next/navigation';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const supabase = await criarClienteSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user !== null) {
    redirect('/chamados');
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">JM Transportes</h1>
          <p className="mt-1 text-sm text-slate-500">Chamados</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
