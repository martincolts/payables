import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateVendorInput } from "@payables/shared";
import { api } from "../api/client";

export function useVendors(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["vendors", page, pageSize],
    queryFn: async () => {
      const res = await api.api.vendors.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) throw new Error("Couldn't load vendors");
      return res.json();
    },
  });
}

/** Reads `{ error }` from a failed response, falling back to a default message. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVendorInput) => {
      const res = await api.api.vendors.$post({ json: input });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't create vendor"));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useDeactivateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.vendors[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't remove vendor"));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}
