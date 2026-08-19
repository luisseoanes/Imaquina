import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { http } from "@/lib/http";

interface ProjectCard {
  id: string;
  slug: string;
  grade: string;
  title: string;
  summary: string | null;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => http<ProjectCard[]>({ url: "/learn/projects" }),
  });

  if (isLoading) return <p className="p-6">{t("common.loading")}</p>;
  if (!data?.length) return <p className="p-6">{t("projects.empty")}</p>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">{t("projects.title")}</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {data.map((p) => (
          <li key={p.id} className="rounded border p-4">
            <Link to={`/projects/${p.id}`} className="font-medium hover:underline">
              {p.title}
            </Link>
            <p className="text-sm text-content-subtle">
              {t("projects.grade")} {p.grade}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
