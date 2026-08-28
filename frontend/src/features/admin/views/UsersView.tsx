import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  PastelBadge,
  QueryState,
  Select,
  SlideOver,
  TextInput,
  useForm,
} from "@/shared/ui/panel";
import type { Tone } from "@/shared/ui/panel";
import { ROLES } from "@/shared/config/roles";
import { useAdmin } from "../AdminContext";
import { useUserMutations, useUsers } from "../api";
import type { AdminUser } from "../api";

const ROLE_TONE: Record<string, Tone> = {
  admin: "danger",
  editor: "brand",
  teacher: "success",
  student: "violet",
};

interface FormValues {
  email: string;
  full_name: string;
  password: string;
  role: string;
  grade: string;
}
const EMPTY: FormValues = {
  email: "",
  full_name: "",
  password: "",
  role: "student",
  grade: "",
};

export function UsersView() {
  const { t } = useTranslation();
  const { search } = useAdmin();
  const { data, isLoading, error } = useUsers();
  const m = useUserMutations();

  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const form = useForm<FormValues>(EMPTY);

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((u) => (filter === "all" ? true : u.role === filter))
        .filter((u) =>
          `${u.full_name} ${u.email}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    [data, filter, search],
  );

  const openNew = () => {
    setEditing(null);
    form.reset();
    setOpen(true);
  };
  const openEdit = (u: AdminUser) => {
    setEditing(u);
    form.reset();
    form.set("email", u.email);
    form.set("full_name", u.full_name);
    form.set("role", u.role);
    form.set("grade", u.grade ?? "");
    setOpen(true);
  };

  const submit = async () => {
    const v = form.values;
    if (editing) {
      await m.update.mutateAsync({
        id: editing.id,
        full_name: v.full_name,
        role: v.role,
        grade: v.grade || null,
      });
    } else {
      await m.create.mutateAsync({
        email: v.email,
        full_name: v.full_name,
        password: v.password,
        role: v.role,
        grade: v.grade || null,
      });
    }
    setOpen(false);
  };

  const toggleActive = (u: AdminUser) =>
    m.update.mutate({ id: u.id, is_active: !u.is_active });

  const resetPassword = async (u: AdminUser) => {
    const pass = prompt(t("admin.users.resetPrompt", { name: u.full_name }));
    if (pass && pass.length >= 8) {
      await m.resetPassword.mutateAsync({ id: u.id, new_password: pass });
      alert(t("admin.users.resetDone"));
    } else if (pass) {
      alert(t("admin.users.resetTooShort"));
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("admin.nav.users")}
        description={t("admin.users.subtitle")}
        actions={
          <>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">{t("admin.users.allRoles")}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`admin.role.${r}`, r)}
                </option>
              ))}
            </Select>
            <Button onClick={openNew}>{t("admin.users.new")}</Button>
          </>
        }
      />

      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? (
          <EmptyState message={t("admin.users.empty")} />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line/60 text-xs uppercase tracking-wide text-content-subtle">
                    <th className="px-5 py-3.5 font-semibold">{t("admin.col.name")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t("admin.col.role")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t("admin.col.grade")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t("admin.col.status")}</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {rows.map((u) => (
                    <tr key={u.id} className={u.is_active ? "" : "opacity-55"}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-content">{u.full_name}</p>
                        <p className="text-xs text-content-subtle">{u.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <PastelBadge tone={ROLE_TONE[u.role] ?? "neutral"}>
                          {t(`admin.role.${u.role}`, u.role)}
                        </PastelBadge>
                      </td>
                      <td className="px-5 py-4 text-content-muted">{u.grade ?? "—"}</td>
                      <td className="px-5 py-4">
                        <PastelBadge tone={u.is_active ? "success" : "neutral"}>
                          {u.is_active
                            ? t("admin.status.active")
                            : t("admin.status.inactive")}
                        </PastelBadge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="text-brand-ink hover:underline"
                          >
                            {t("admin.action.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void resetPassword(u)}
                            className="text-content-muted hover:text-content"
                          >
                            {t("admin.action.resetPassword")}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(u)}
                            className={u.is_active ? "text-danger hover:underline" : "text-success hover:underline"}
                          >
                            {u.is_active
                              ? t("admin.action.deactivate")
                              : t("admin.action.activate")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryState>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("admin.users.edit") : t("admin.users.new")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {!editing ? (
            <Field label={t("admin.field.email")}>
              <TextInput
                type="email"
                required
                value={form.values.email}
                onChange={(e) => form.set("email", e.target.value)}
              />
            </Field>
          ) : null}
          <Field label={t("admin.field.fullName")}>
            <TextInput
              required
              value={form.values.full_name}
              onChange={(e) => form.set("full_name", e.target.value)}
            />
          </Field>
          {!editing ? (
            <Field label={t("admin.field.password")} hint={t("admin.field.passwordHint")}>
              <TextInput
                type="text"
                required
                minLength={8}
                value={form.values.password}
                onChange={(e) => form.set("password", e.target.value)}
              />
            </Field>
          ) : null}
          <Field label={t("admin.col.role")}>
            <Select
              value={form.values.role}
              onChange={(e) => form.set("role", e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`admin.role.${r}`, r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.col.grade")} hint={t("admin.field.gradeHint")}>
            <TextInput
              value={form.values.grade}
              onChange={(e) => form.set("grade", e.target.value)}
            />
          </Field>
          {(m.create.error || m.update.error) && (
            <p className="mb-2 text-sm text-danger">
              {((m.create.error ?? m.update.error) as Error)?.message ??
                t("common.error")}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={m.create.isPending || m.update.isPending}>
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
