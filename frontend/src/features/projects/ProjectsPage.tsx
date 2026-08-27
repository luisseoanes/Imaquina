import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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

  if (isLoading) return <p className="p-4 sm:p-6">{t("common.loading")}</p>;

  if (!data?.length)
    return (
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
          <FolderOpen className="text-content-subtle" size={32} aria-hidden />
          <p className="text-content-subtle">{t("projects.empty")}</p>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="mb-6 font-display text-2xl font-bold">{t("projects.title")}</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {data.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="block">
              <Card interactive className="p-4">
                <p className="font-medium">{p.title}</p>
                {p.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-content-muted">
                    {p.summary}
                  </p>
                )}
                <Badge tone="brand" className="mt-3">
                  {t("projects.grade")} {p.grade}
                </Badge>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
