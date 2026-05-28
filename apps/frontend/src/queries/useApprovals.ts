import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubmitApprovalInput } from "@payables/shared";
import { api } from "../api/client";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

/** The approval summary for a bill (decisions + quorum progress). */
export function useApprovals(billId: string | null) {
  return useQuery({
    queryKey: ["approvals", billId],
    enabled: billId !== null,
    queryFn: async () => {
      const res = await api.api.bills[":id"].approvals.$get({ param: { id: billId! } });
      if (!res.ok) throw new Error("Couldn't load approvals");
      return res.json();
    },
  });
}

/** Submits the current user's approve/reject decision on a bill. */
export function useSubmitApproval(billId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitApprovalInput) => {
      const res = await api.api.bills[":id"].approvals.$post({
        param: { id: billId },
        json: input,
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't record decision"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", billId] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", billId] });
    },
  });
}

/** Submits a draft bill for approval (admin). */
export function useSubmitBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (billId: string) => {
      const res = await api.api.bills[":id"].submit.$post({ param: { id: billId } });
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't submit bill"));
      return res.json();
    },
    onSuccess: (_, billId) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bill", billId] });
    },
  });
}
