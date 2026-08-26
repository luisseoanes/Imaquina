import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { ApiError } from "@/lib/http";
import {
  useCourses,
  useCourseStudents,
  useCreateCourse,
  useCreateUser,
  useEnroll,
  useResetPassword,
  useSetUserActive,
  useUnenroll,
  useUsers,
} from "./api";

const usuarioEsquema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["student", "teacher", "editor", "admin"]),
  grade: z.string().optional(),
});
type UsuarioForm = z.infer<typeof usuarioEsquema>;

function AltaDeUsuario() {
  const { t } = useTranslation();
  const crear = useCreateUser();
  const { register, handleSubmit, reset, formState } = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioEsquema),
    mode: "onChange",
    defaultValues: { email: "", full_name: "", password: "", role: "student", grade: "" },
  });

  return (
    <form
      className="mb-4 grid gap-3 rounded border p-4 sm:grid-cols-6"
      onSubmit={handleSubmit((datos) =>
        crear.mutate({ ...datos, grade: datos.grade || undefined }, { onSuccess: () => reset() }),
      )}
    >
      <label className="sm:col-span-2">
        <span className="text-sm font-medium">{t("admin.email")}</span>
        <input {...register("email")} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm font-medium">{t("admin.fullName")}</span>
        <input {...register("full_name")} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium">{t("admin.password")}</span>
        <input
          type="password"
          {...register("password")}
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
        />
      </label>
      <label>
        <span className="text-sm font-medium">{t("admin.role")}</span>
        <select {...register("role")} className="mt-1 w-full rounded border px-2 py-1 text-sm">
          <option value="student">{t("roles.student")}</option>
          <option value="teacher">{t("roles.teacher")}</option>
          <option value="editor">{t("roles.editor")}</option>
          <option value="admin">{t("roles.admin")}</option>
        </select>
      </label>
      <label>
        <span className="text-sm font-medium">{t("admin.grade")}</span>
        <input {...register("grade")} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
      </label>
      <div className="sm:col-span-6">
        <button
          type="submit"
          disabled={crear.isPending || !formState.isValid}
          className="rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:opacity-50"
        >
          {t("admin.createUser")}
        </button>
        {crear.error instanceof ApiError && (
          <span className="ml-3 text-sm text-danger">{crear.error.message}</span>
        )}
      </div>
    </form>
  );
}

/** Restablecer la contraseña de una cuenta (N15).
 *
 *  Es la única recuperación que hay: no se envía correo —las cuentas de
 *  menores se crean sin buzón propio—, así que el administrador fija una y la
 *  entrega por el canal del colegio. Se muestra en claro tras guardarla
 *  porque si no, no habría forma de comunicarla.
 */
function ResetDeContrasena({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");
  const reset = useResetPassword();

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded border px-2 py-0.5 text-xs hover:underline"
      >
        {t("admin.resetPassword")}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={valor}
        autoFocus
        placeholder={t("admin.newPassword")}
        onChange={(e) => setValor(e.target.value)}
        className="w-40 rounded border px-2 py-0.5 text-xs"
      />
      <button
        disabled={valor.length < 8 || reset.isPending}
        onClick={() => reset.mutate({ id: userId, new_password: valor })}
        className="rounded bg-brand px-2 py-0.5 text-xs text-brand-content disabled:opacity-50"
      >
        {t("common.save")}
      </button>
      <button
        onClick={() => {
          setAbierto(false);
          setValor("");
          reset.reset();
        }}
        className="text-xs text-content-subtle hover:underline"
      >
        {t("common.cancel")}
      </button>
      {reset.isSuccess && <span className="text-xs text-success-content">{t("admin.passwordReset")}</span>}
      {reset.error instanceof ApiError && (
        <span className="text-xs text-danger">{reset.error.message}</span>
      )}
    </span>
  );
}

function ListaDeUsuarios() {
  const { t } = useTranslation();
  const { data } = useUsers();
  const activar = useSetUserActive();

  return (
    <ul className="mb-8 divide-y rounded border">
      {data?.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="flex-1">
            {u.full_name} <span className="text-content-subtle">· {u.email}</span>
          </span>
          <span className="text-content-subtle">{t(`roles.${u.role}`)}</span>
          <ResetDeContrasena userId={u.id} />
          <button
            onClick={() => activar.mutate({ id: u.id, is_active: !u.is_active })}
            className={`rounded px-2 py-0.5 text-xs ${
              u.is_active ? "bg-success text-success-content" : "bg-surface-muted text-content-muted"
            }`}
          >
            {u.is_active ? t("admin.active") : t("admin.inactive")}
          </button>
        </li>
      ))}
    </ul>
  );
}

const cursoEsquema = z.object({ name: z.string().min(1), grade: z.string().min(1) });
type CursoForm = z.infer<typeof cursoEsquema>;

function AltaDeCurso() {
  const { t } = useTranslation();
  const crear = useCreateCourse();
  const { register, handleSubmit, reset, formState } = useForm<CursoForm>({
    resolver: zodResolver(cursoEsquema),
    mode: "onChange",
    defaultValues: { name: "", grade: "" },
  });

  return (
    <form
      className="mb-4 grid gap-3 rounded border p-4 sm:grid-cols-3"
      onSubmit={handleSubmit((datos) => crear.mutate(datos, { onSuccess: () => reset() }))}
    >
      <label>
        <span className="text-sm font-medium">{t("admin.courseName")}</span>
        <input {...register("name")} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium">{t("admin.grade")}</span>
        <input {...register("grade")} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={crear.isPending || !formState.isValid}
          className="rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:opacity-50"
        >
          {t("admin.createCourse")}
        </button>
      </div>
    </form>
  );
}

function Matricula({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const { data: usuarios } = useUsers();
  const { data: matriculados } = useCourseStudents(courseId);
  const enrolar = useEnroll(courseId);
  const desenrolar = useUnenroll(courseId);
  const [seleccionado, setSeleccionado] = useState("");

  const estudiantes = usuarios?.filter((u) => u.role === "student") ?? [];
  const idsMatriculados = new Set(matriculados?.map((m) => m.id));

  return (
    <div className="border-t bg-surface-muted p-3">
      <div className="mb-2 flex gap-2">
        <select
          value={seleccionado}
          onChange={(e) => setSeleccionado(e.target.value)}
          className="flex-1 rounded border px-2 py-1 text-sm"
        >
          <option value="">{t("admin.pickStudent")}</option>
          {estudiantes
            .filter((e) => !idsMatriculados.has(e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
        </select>
        <button
          disabled={!seleccionado}
          onClick={() => seleccionado && enrolar.mutate(seleccionado, { onSuccess: () => setSeleccionado("") })}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {t("admin.enroll")}
        </button>
      </div>
      <ul className="space-y-1">
        {matriculados?.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{m.full_name}</span>
            <button onClick={() => desenrolar.mutate(m.id)} className="text-xs text-danger hover:underline">
              {t("admin.unenroll")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListaDeCursos() {
  const { t } = useTranslation();
  const { data } = useCourses();
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <ul className="divide-y rounded border">
      {data?.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => setAbierto((v) => (v === c.id ? null : c.id))}
            className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-surface-muted"
          >
            <span className="flex-1 font-medium">{c.name}</span>
            <span className="text-content-subtle">
              {t("studio.grade")} {c.grade}
            </span>
          </button>
          {abierto === c.id && <Matricula courseId={c.id} />}
        </li>
      ))}
    </ul>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold">{t("admin.title")}</h1>

      <h2 className="mb-2 font-medium">{t("admin.users")}</h2>
      <AltaDeUsuario />
      <ListaDeUsuarios />

      <h2 className="mb-2 font-medium">{t("admin.courses")}</h2>
      <AltaDeCurso />
      <ListaDeCursos />
    </main>
  );
}
