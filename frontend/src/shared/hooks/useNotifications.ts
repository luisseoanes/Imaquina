import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";

/** Notificaciones in-app. La campana hace polling ligero a `unread-count` y
 *  sólo pide la lista completa al desplegarse. */
export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: boolean;
}

const BASE = env.apiBaseUrl;

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => httpClient<{ unread: number }>(`${BASE}/notifications/unread-count`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () =>
      httpClient<{ items: Notification[]; unread: number }>(
        `${BASE}/notifications`,
      ),
    enabled,
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return {
    markRead: useMutation({
      mutationFn: (id: string) =>
        httpClient<void>(`${BASE}/notifications/${id}/read`, { method: "POST" }),
      onSuccess: invalidate,
    }),
    markAll: useMutation({
      mutationFn: () =>
        httpClient<void>(`${BASE}/notifications/read-all`, { method: "POST" }),
      onSuccess: invalidate,
    }),
  };
}
