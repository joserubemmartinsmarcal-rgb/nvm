import { redirect } from 'next/navigation';

/** A raiz não tem conteúdo próprio: quem abre o site quer ver os chamados. */
export default function Home() {
  redirect('/chamados');
}
