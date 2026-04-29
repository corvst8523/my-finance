import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name =
    typeof user.user_metadata.name === "string" && user.user_metadata.name.trim().length > 0
      ? user.user_metadata.name
      : user.email ?? "Usuario";

  return (
    <AppShell userName={name} currentMonth={format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}>
      {children}
    </AppShell>
  );
}
