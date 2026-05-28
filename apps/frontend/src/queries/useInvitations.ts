import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInvitationInput } from "@payables/shared";
import { api } from "../api/client";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export interface InvitationsQuery {
  page?: number;
  pageSize?: number;
}

export function useInvitations(query: InvitationsQuery = {}) {
  const { page = 1, pageSize = 50 } = query;
  return useQuery({
    queryKey: ["invitations", page, pageSize],
    queryFn: async () => {
      const res = await api.api.invitations.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) throw new Error("Couldn't load invitations");
      return res.json();
    },
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      const res = await api.api.invitations.$post({ json: input });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't send invitation"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
