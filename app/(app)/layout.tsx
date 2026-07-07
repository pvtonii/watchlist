import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/bottom-nav";

/**
 * Authed area. Estrutura da receita Melhores Práticas v3:
 * conteúdo dentro de #app (max-width), nav FORA do #app —
 * filha direta do <body> para o position:fixed ancorar na janela.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <div id="app">{children}</div>
      <BottomNav />
    </>
  );
}
