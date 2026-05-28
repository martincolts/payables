import { useQuery } from "@tanstack/react-query";
import type { StatsRange } from "@payables/shared";
import { api } from "../api/client";

export function useDashboardStats(range: StatsRange = "12m") {
  return useQuery({
    queryKey: ["stats", "dashboard", range],
    queryFn: async () => {
      const res = await api.api.stats.dashboard.$get({ query: { range } });
      if (!res.ok) throw new Error("Couldn't load stats");
      return res.json();
    },
  });
}
