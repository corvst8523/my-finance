"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type SignupResult = { ok: true } | { ok: false, error: string };

export async function signupAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<SignupResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email) {
    return { ok: false, error: "Informe um email valido." };
  }

  if (password.length < 8) {
    return { ok: false, error: "A senha precisa ter no minimo 8 caracteres." };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    if (isAlreadyRegisteredError(error.message, error.status, error.code)) {
      return { ok: false, error: "Essa conta ja esta cadastrada." };
    }

    return { ok: false, error: error.message };
  }

  if (!data?.user) {
    return { ok: false, error: "Nao foi possivel criar a conta." };
  }

  return { ok: true };
}

function isAlreadyRegisteredError(
  message: string | undefined,
  status: number | undefined,
  code: string | undefined,
) {
  if (status === 422) return true;
  if (code && /already|exists|registered|duplicate/i.test(code)) return true;
  if (message && /already|exists|registered|duplicate/i.test(message)) return true;
  return false;
}
