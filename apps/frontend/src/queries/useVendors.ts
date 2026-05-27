import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useVendors(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["vendors", page, pageSize],
    queryFn: async () => {
      const res = await api.api.vendors.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) throw new Error("No se pudieron cargar los proveedores");
      return res.json();
    },
  });
}
