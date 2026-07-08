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
  // getSession() (not getUser()) — no extra network round-trip to Supabase.
  // The proxy already validated/refreshed the token for this exact request
  // (lib/supabase/server.ts), so the cookie session here is already trustworthy.
  // This layout re-runs on every tab switch (dynamic due to cookies()), so a
  // second getUser() call here would double the auth latency on every click.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  return (
    <>
      <div id="app">{children}</div>
      <BottomNav />
    </>
  );
}
