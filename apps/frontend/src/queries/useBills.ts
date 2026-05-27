import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { BillStatus } from "@payables/shared";
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
