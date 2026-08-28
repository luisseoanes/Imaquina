import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { crearQueryClient } from "./queryClient";

export function QueryProvider({ children }: { children: ReactNode }) {
  // En estado y no como constante de módulo: dos tests que compartan cliente
  // comparten caché, y el segundo lee datos que sembró el primero.
  const [client] = useState(crearQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
