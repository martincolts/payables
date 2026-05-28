import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrganizationInput } from "@payables/shared";
import { api } from "../api/client";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function useOrganization() {
  return useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const res = await api.api.organization.$get();
      if (!res.ok) throw new Error("Couldn't load organization settings");
      return res.json();
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      const res = await api.api.organization.$patch({ json: input });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't update settings"));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization"] }),
  });
}

export interface MembersQuery {
  page?: number;
  pageSize?: number;
}

export function useMembers(query: MembersQuery = {}) {
  const { page = 1, pageSize = 50 } = query;
  return useQuery({
    queryKey: ["members", page, pageSize],
    queryFn: async () => {
      const res = await api.api.organization.members.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) throw new Error("Couldn't load team members");
      return res.json();
    },
  });
}
