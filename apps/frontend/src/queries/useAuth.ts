import { useMutation } from "@tanstack/react-query";
import type { AuthResponse, LoginInput, SignupInput } from "@payables/shared";
import { api } from "../api/client";

async function unwrap(res: Response, fallback: string): Promise<AuthResponse> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? fallback);
  }
  return res.json() as Promise<AuthResponse>;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await api.api.auth.login.$post({ json: input });
      return unwrap(res, "No se pudo iniciar sesión");
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const res = await api.api.auth.signup.$post({ json: input });
      return unwrap(res, "No se pudo crear la cuenta");
    },
  });
}
