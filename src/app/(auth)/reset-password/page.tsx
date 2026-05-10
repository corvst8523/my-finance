"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error: getUserError }) => {
      if (cancelled) return;
      setHasSession(!!data.user && !getUserError);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < 8) {
      setError("A senha precisa ter no minimo 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas nao conferem.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.replace("/app/cashflow");
    router.refresh();
  }

  return (
    <main className="bg-muted/40 grid min-h-dvh place-items-center px-4">
      <section className="border-border bg-background w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-muted-foreground text-sm font-medium">My Finance</p>
          <h1 className="text-2xl font-semibold tracking-tight">Nova senha</h1>
        </div>

        {hasSession === false ? (
          <div className="space-y-4">
            <p className="text-sm">
              O link de recuperacao expirou ou ja foi utilizado. Solicite um novo para continuar.
            </p>
            <Link
              href="/forgot-password"
              className="text-foreground text-sm font-medium underline-offset-4 hover:underline"
            >
              Pedir novo link
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button
              type="submit"
              className="w-full hover:scale-[1.01]"
              disabled={pending || hasSession === null}
            >
              {pending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
