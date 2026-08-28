import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";

export interface SearchHit {
  id: string;
  title: string;
  status?: string;
  grade?: string;
  email?: string;
  role?: string;
}
export type SearchResults = Record<string, SearchHit[]>;

/** Búsqueda transversal con debounce. Devuelve resultados agrupados por tipo
 *  (`projects`, `lessons`, `courses`, `users`…), acotados por rol en el
 *  servidor. */
export function useSearch(query: string) {
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const q = query.trim();
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [query]);

  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () =>
      httpClient<SearchResults>(
        `${env.apiBaseUrl}/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });
}
