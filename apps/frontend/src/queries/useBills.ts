import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { BillStatus, CreateBillInput } from "@payables/shared";
import { api } from "../api/client";

export interface BillsQuery {
  page?: number;
  pageSize?: number;
  status?: BillStatus;
  search?: string;
}

export function useBills(query: BillsQuery = {}) {
  const { page = 1, pageSize = 20, status, search } = query;

  return useQuery({
    queryKey: ["bills", page, pageSize, status ?? null, search ?? null],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await api.api.bills.$get({
        query: {
          page: String(page),
          pageSize: String(pageSize),
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
        },
      });
      if (!res.ok) throw new Error("Couldn't load bills");
      return res.json();
    },
  });
}

/** Reads `{ error }` from a failed response, falling back to a default message. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBillInput) => {
      const res = await api.api.bills.$post({ json: input });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't create bill"));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.bills[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't delete bill"));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
  });
}
