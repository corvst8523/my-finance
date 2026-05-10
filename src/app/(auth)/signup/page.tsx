"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signupAction } from "../actions";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (password.length < 8) {
      setError("A senha precisa ter no minimo 8 caracteres.");
      return;
    }

    setPending(true);
    const result = await signupAction({ name, email, password });

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);

    if (signInError) {
      router.replace("/login");
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
          <h1 className="text-2xl font-semibold tracking-tight">Cadastrar</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" className="w-full hover:scale-[1.01]" disabled={pending}>
            {pending ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-5 text-center text-sm">
          Ja tem conta?{" "}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
