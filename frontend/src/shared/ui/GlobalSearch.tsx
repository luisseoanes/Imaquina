import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useSearch } from "@/shared/hooks/useSearch";
import { Icon } from "@/shared/ui/panel-icons";

function linkFor(pathname: string, type: string, id: string): string {
  const base = pathname.startsWith("/studio")
    ? "studio"
    : pathname.startsWith("/admin")
      ? "admin"
      : "teacher";
  switch (type) {
    case "projects":
      return base === "studio" ? `/studio/projects/${id}` : `/teacher/content/${id}`;
    case "lessons":
      return "/studio/lessons";
    case "resources":
      return "/studio/resources";
    case "courses":
      return base === "admin" ? `/admin/courses/${id}` : `/teacher/courses/${id}`;
    case "users":
      return "/admin/users";
    default:
      return pathname;
  }
}

/** Buscador de la barra superior: escribe → filtra la vista actual (via
 *  `onChange`) Y despliega resultados transversales del servidor. */
export function GlobalSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (q: string) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useSearch(value);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const groups = Object.entries(data ?? {}).filter(([, hits]) => hits.length > 0);
  const showDropdown = focused && value.trim().length >= 2;

  return (
    <div ref={ref} className="relative min-w-0 flex-1 lg:max-w-xl">
      <Icon
        name="search"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-pill border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-content transition duration-150 placeholder:text-content-subtle focus:border-brand-ink"
      />

      {showDropdown ? (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-line/60 bg-surface shadow-float">
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-content-muted">
              {isFetching ? t("common.loading") : t("search.empty")}
            </p>
          ) : (
            groups.map(([type, hits]) => (
              <div key={type} className="py-1">
                <p className="px-4 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-content-subtle">
                  {t(`search.type.${type}`, type)}
                </p>
                {hits.map((h) => (
                  <button
                    key={`${type}-${h.id}`}
                    type="button"
                    onClick={() => {
                      setFocused(false);
                      navigate(linkFor(pathname, type, h.id));
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-content transition duration-150 hover:bg-surface-muted"
                  >
                    <span className="truncate">{h.title}</span>
                    {h.email ? (
                      <span className="truncate text-xs text-content-subtle">
                        {h.email}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
