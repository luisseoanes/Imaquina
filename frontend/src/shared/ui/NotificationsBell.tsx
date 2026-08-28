import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  useNotificationActions,
  useNotifications,
  useUnreadCount,
} from "@/shared/hooks/useNotifications";
import { Icon } from "@/shared/ui/panel-icons";
import type { IconName } from "@/shared/ui/panel-icons";

const KIND_ICON: Record<string, IconName> = {
  "assignment.new": "check-square",
  "assignment.due_soon": "clock",
  "attempt.submitted": "check-square",
  "attempt.graded": "star",
  "license.expiring": "settings",
};

export function NotificationsBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const count = useUnreadCount();
  const list = useNotifications(open);
  const actions = useNotificationActions();
  const unread = count.data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        className="relative rounded-full p-2 text-content-muted transition duration-150 hover:bg-surface-muted hover:text-content"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-bold text-brand-content">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line/60 bg-surface shadow-float">
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-2.5">
            <p className="text-sm font-bold text-content">{t("notifications.title")}</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => actions.markAll.mutate()}
                className="text-xs text-brand-ink hover:underline"
              >
                {t("notifications.markAll")}
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-content-muted">
                {t("common.loading")}
              </p>
            ) : (list.data?.items ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-content-muted">
                {t("notifications.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-line/50">
                {(list.data?.items ?? []).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) actions.markRead.mutate(n.id);
                        setOpen(false);
                        if (n.link) navigate(n.link);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition duration-150 hover:bg-surface-muted ${
                        n.read ? "opacity-60" : ""
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                        <Icon name={KIND_ICON[n.kind] ?? "bell"} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-content">
                          {n.title}
                        </span>
                        {n.body ? (
                          <span className="block text-xs text-content-muted">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-[0.68rem] text-content-subtle">
                          {new Date(n.created_at).toLocaleDateString(i18n.language, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      {!n.read ? (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
