import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LANGS } from "@/shared/config/roles";
import { setLanguage } from "@/shared/i18n";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMe } from "@/shared/hooks/useMe";
import { ApiError } from "@/shared/api/ApiError";
import {
  Button,
  Card,
  Field,
  PageHeader,
  TextInput,
} from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useChangeOwnPassword } from "@/shared/hooks/useChangeOwnPassword";

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { data: me } = useMe();
  const changePw = useChangeOwnPassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const iniciales = (me?.full_name ?? "Admin")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const submitPw = async () => {
    setMsg(null);
    try {
      await changePw.mutateAsync({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setMsg({ ok: true, text: t("admin.settings.pwDone") });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : t("common.error"),
      });
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={t("admin.nav.settings")}
        description={t("admin.settings.subtitle")}
      />

      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-extrabold text-brand-ink">
            {iniciales}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display font-bold text-content">
              {me?.full_name ?? "—"}
            </p>
            <p className="truncate text-xs text-content-muted">
              {me?.email ?? session?.role}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-danger-surface px-2 py-0.5 text-[0.7rem] font-semibold text-danger">
              <Icon name="settings" className="h-3 w-3" />
              {t("admin.role.admin")}
            </span>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 font-display text-base font-bold text-content">
          {t("admin.settings.language")}
        </h2>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              aria-pressed={i18n.language === l}
              className={`rounded-control px-3 py-2 text-sm font-semibold transition duration-150 ${
                i18n.language === l
                  ? "bg-brand text-brand-content"
                  : "bg-surface-muted text-content"
              }`}
            >
              {t(`admin.settings.lang.${l}`, l)}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-content">
          {t("admin.settings.password")}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitPw();
          }}
        >
          <Field label={t("admin.settings.currentPassword")}>
            <TextInput
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field
            label={t("admin.settings.newPassword")}
            hint={t("admin.field.passwordHint")}
          >
            <TextInput
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          {msg ? (
            <p className={`mb-2 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>
              {msg.text}
            </p>
          ) : null}
          <Button type="submit" disabled={changePw.isPending}>
            {t("admin.settings.changePassword")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
