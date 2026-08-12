import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./http";

/** TanStack Query es la capa de estado de servidor. Sin Redux:
 *  casi todo el estado de esta app son datos del servidor. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry(count, error) {
        if (error instanceof ApiError && error.status < 500) return false;
        return count < 2;
      },
    },
  },
});
