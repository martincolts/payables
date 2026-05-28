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
  vendorId?: string;
  dueAfter?: string;
  dueBefore?: string;
}

export function useBills(query: BillsQuery = {}) {
  const { page = 1, pageSize = 20, status, search, vendorId, dueAfter, dueBefore } = query;

  return useQuery({
    queryKey: [
      "bills",
      page,
      pageSize,
      status ?? null,
      search ?? null,
      vendorId ?? null,
      dueAfter ?? null,
      dueBefore ?? null,
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await api.api.bills.$get({
        query: {
          page: String(page),
          pageSize: String(pageSize),
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(vendorId ? { vendorId } : {}),
          ...(dueAfter ? { dueAfter } : {}),
          ...(dueBefore ? { dueBefore } : {}),
        },
      });
      if (!res.ok) throw new Error("Couldn't load bills");
      return res.json();
    },
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ["bill", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.api.bills[":id"].$get({ param: { id: id! } });
      if (!res.ok) throw new Error("Couldn't load bill");
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

/** Demo-only: marks a bill as paid (no real payment is processed). */
export function useSimulatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.bills[":id"]["simulate-payment"].$post({
        param: { id },
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't simulate payment"));
      return res.json();
    },
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", bill.id] });
    },
  });
}

/** Demo-only: marks a bill as payment_failed. */
export function useSimulatePaymentFailure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.bills[":id"]["simulate-payment-failure"].$post({
        param: { id },
      });
      if (!res.ok)
        throw new Error(await errorMessage(res, "Couldn't simulate payment failure"));
      return res.json();
    },
    onSuccess: (bill) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", bill.id] });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.bills[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't delete bill"));
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", id] });
    },
  });
}
