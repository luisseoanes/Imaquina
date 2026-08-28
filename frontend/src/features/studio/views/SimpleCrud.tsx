/** Andamiaje CRUD compartido por las vistas de lista del Studio (recursos,
 *  rutas, plantillas, etiquetas, colecciones).
 *
 *  Cada vista declara sus columnas y sus campos de formulario; esto pone la
 *  tabla, el panel lateral, los estados de carga/error y los botones. Evita
 *  repetir ~180 líneas por pestaña.
 */
import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  Select,
  SlideOver,
  TextArea,
  TextInput,
} from "@/shared/ui/panel";

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "url";
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  perLang?: boolean;
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

interface Props<T extends { id: string }> {
  title: string;
  subtitle: string;
  newLabel: string;
  lang: string;
  rows: T[] | undefined;
  isLoading: boolean;
  error: unknown;
  emptyMessage: string;
  columns: Column<T>[];
  fields: FieldSpec[];
  toForm: (row: T) => Record<string, string>;
  blankForm: Record<string, string>;
  onCreate: (values: Record<string, string>) => Promise<unknown>;
  onUpdate: (id: string, values: Record<string, string>) => Promise<unknown>;
  onDelete?: (id: string) => void;
  rowActions?: (row: T) => ReactNode;
  saving?: boolean;
  saveError?: unknown;
}

export function SimpleCrud<T extends { id: string }>(props: Props<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(props.blankForm);

  const openNew = () => {
    setEditingId(null);
    setValues(props.blankForm);
    setOpen(true);
  };
  const openEdit = (row: T) => {
    setEditingId(row.id);
    setValues(props.toForm(row));
    setOpen(true);
  };
  const submit = async () => {
    if (editingId) await props.onUpdate(editingId, values);
    else await props.onCreate(values);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title={props.title}
        description={props.subtitle}
        actions={<Button onClick={openNew}>{props.newLabel}</Button>}
      />
      <QueryState isLoading={props.isLoading} error={props.error}>
        {(props.rows ?? []).length === 0 ? (
          <EmptyState message={props.emptyMessage} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-content-subtle">
                <tr>
                  {props.columns.map((c) => (
                    <th key={c.key} className="px-4 py-3">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(props.rows ?? []).map((row) => (
                  <tr key={row.id}>
                    {props.columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-content-muted">
                        {c.render(row)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {props.rowActions?.(row)}
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-brand-ink hover:underline"
                        >
                          {t("studio.action.edit")}
                        </button>
                        {props.onDelete ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(t("studio.action.confirmDelete")))
                                props.onDelete?.(row.id);
                            }}
                            className="text-danger hover:underline"
                          >
                            {t("studio.action.delete")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </QueryState>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? t("studio.action.edit") : props.newLabel}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {props.fields.map((f) => {
            const label = f.perLang
              ? `${f.label} (${props.lang.toUpperCase()})`
              : f.label;
            const common = {
              value: values[f.name] ?? "",
              onChange: (
                e: ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                >,
              ) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
              required: f.required,
            };
            return (
              <Field key={f.name} label={label} hint={f.hint}>
                {f.type === "textarea" ? (
                  <TextArea rows={5} {...common} />
                ) : f.type === "select" ? (
                  <Select {...common}>
                    <option value="">—</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <TextInput
                    type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                    {...common}
                  />
                )}
              </Field>
            );
          })}
          {props.saveError ? (
            <p className="mb-2 text-sm text-danger">
              {props.saveError instanceof Error
                ? props.saveError.message
                : t("common.error")}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button type="submit" disabled={props.saving}>
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
