"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      setError("Informe um email valido.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setPending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="bg-muted/40 grid min-h-dvh place-items-center px-4">
      <section className="border-border bg-background w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-muted-foreground text-sm font-medium">My Finance</p>
          <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm">
              Se houver uma conta com esse email, enviamos um link para redefinir a senha. Verifique
              sua caixa de entrada e a pasta de spam.
            </p>
            <Link
              href="/login"
              className="text-foreground text-sm font-medium underline-offset-4 hover:underline"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <Button type="submit" className="w-full hover:scale-[1.01]" disabled={pending}>
                {pending ? "Enviando..." : "Enviar link de recuperacao"}
              </Button>
            </form>

            <p className="text-muted-foreground mt-5 text-center text-sm">
              Lembrou da senha?{" "}
              <Link
                href="/login"
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
