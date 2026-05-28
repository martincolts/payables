import { useQuery } from "@tanstack/react-query";
import type { ApAgingReport } from "@payables/shared";
import { api } from "../api/client";

export function useApAging(asOf: string) {
  return useQuery<ApAgingReport>({
    queryKey: ["stats", "ap-aging", asOf],
    queryFn: async () => {
      const res = await api.api.stats["ap-aging"].$get({ query: { asOf } });
      if (!res.ok) throw new Error("Couldn't load AP Aging");
      return res.json();
    },
  });
}
