import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  AcceptInvitationInput,
  AuthResponse,
  InvitationPreview,
  LoginInput,
  SignupInput,
} from "@payables/shared";
import { api } from "../api/client";

type ErrorBody = {
  error?: unknown;
  message?: string;
};

type ZodIssue = { message?: string; path?: Array<string | number> };

function extractMessage(body: ErrorBody | null): string | null {
  if (!body) return null;
  if (typeof body.error === "string") return body.error;
  if (typeof body.message === "string") return body.message;
  const err = body.error as { issues?: ZodIssue[] } | undefined;
  const issues = err?.issues;
  if (issues && issues.length > 0) {
    return issues
      .map((i) => {
        const field = i.path?.filter((p) => typeof p === "string").join(".");
        return field ? `${field}: ${i.message ?? "invalid"}` : (i.message ?? "invalid");
      })
      .join("; ");
  }
  return null;
}

async function unwrap(res: Response, fallback: string): Promise<AuthResponse> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorBody | null;
    throw new Error(extractMessage(body) ?? fallback);
  }
  return res.json() as Promise<AuthResponse>;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await api.api.auth.login.$post({ json: input });
      return unwrap(res, "Couldn't sign in");
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const res = await api.api.auth.signup.$post({ json: input });
      return unwrap(res, "Couldn't create account");
    },
  });
}

/** Public: fetches an invitation's details so the accept screen can render them. */
export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ["invitation-preview", token],
    retry: false,
    queryFn: async (): Promise<InvitationPreview> => {
      const res = await api.api.invite[":token"].$get({ param: { token } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "This invitation link is invalid or expired");
      }
      return res.json();
    },
  });
}

/** Public: accepts an invitation by setting a password; returns a session. */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (input: AcceptInvitationInput) => {
      const res = await api.api.invite.accept.$post({ json: input });
      return unwrap(res, "Couldn't accept the invitation");
    },
  });
}
