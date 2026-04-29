"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (signInError) {
      setError("Usuario ou senha invalidos.");
      return;
    }

    router.replace(searchParams.get("next") ?? "/app/cashflow");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4">
      <section className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">My Finance</p>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Usuario</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full hover:scale-[1.01]" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Ainda nao tem conta?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Cadastrar
          </Link>
        </p>
      </section>
    </main>
  );
}
