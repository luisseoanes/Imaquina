/** Mi cuenta — común a todos los roles.
 *
 *  No usa el armazón de ningún panel: es una página autónoma con su propia
 *  cabecera mínima y un enlace de vuelta a la herramienta del rol.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { ApiError } from "@/shared/api/ApiError";
import { LANGS, homeForRole } from "@/shared/config/roles";
import { setLanguage } from "@/shared/i18n";
import { useAuth } from "@/shared/hooks/useAuth";
import { useAccountLang } from "@/shared/hooks/useAccountLang";
import { useChangeOwnPassword } from "@/shared/hooks/useChangeOwnPassword";
import { useMe } from "@/shared/hooks/useMe";
import { BrandLogo } from "@/shared/ui/BrandLogo";
import { Button, Card, Field, TextInput } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { session, logout } = useAuth();
  const { data: me } = useMe();
  const changePw = useChangeOwnPassword();
  const guardarIdioma = useAccountLang();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const home = homeForRole(session?.role ?? "student");
  const iniciales = (me?.full_name ?? "?")
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
      setMsg({ ok: true, text: t("account.pwDone") });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : t("common.error"),
      });
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-line/70 px-4 sm:px-6">
        <BrandLogo className="h-9 w-auto" />
        <div className="flex items-center gap-3 text-sm">
          <Link to={home} className="text-content-muted hover:text-content">
            {t("account.back")}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="text-content-muted hover:text-danger"
          >
            {t("auth.logout")}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-xl p-4 sm:p-6 lg:p-8">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-content">
          {t("account.title")}
        </h1>
        <p className="mt-1 mb-6 text-sm text-content-muted">{t("account.subtitle")}</p>

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
                {me?.email ?? ""}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-surface-muted px-2 py-0.5 text-[0.7rem] font-semibold text-content-muted">
                <Icon name="users" className="h-3 w-3" />
                {t(`account.roleName.${session?.role}`, session?.role ?? "")}
              </span>
            </div>
          </div>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 font-display text-base font-bold text-content">
            {t("account.language")}
          </h2>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLanguage(l);
                  // Si el PATCH falla, la interfaz ya cambió —que es lo que se
                  // pidió— y sólo se pierde la persistencia.
                  guardarIdioma.mutate(l);
                }}
                aria-pressed={i18n.language === l}
                className={`rounded-control px-3 py-2 text-sm font-semibold transition duration-150 ${
                  i18n.language === l
                    ? "bg-brand text-brand-content"
                    : "bg-surface-muted text-content"
                }`}
              >
                {t(`account.lang.${l}`, l)}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-bold text-content">
            {t("account.password")}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitPw();
            }}
          >
            <Field label={t("account.currentPassword")}>
              <TextInput
                type="password"
                required
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field label={t("account.newPassword")} hint={t("account.passwordHint")}>
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
              {t("account.changePassword")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
