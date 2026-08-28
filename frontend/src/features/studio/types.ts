/** Formas que devuelve el backend del Studio.
 *
 *  A mano y no desde orval: el generado está gitignored y `api:gen` necesita
 *  el backend vivo, así que importarlo rompería el build en un clon recién
 *  hecho (ver CLAUDE.md § Frontend).
 */
import type { Lang } from "@/shared/config/roles";

export type ContentStatus = "draft" | "published";
export type RefType = "project" | "lesson" | "resource" | "assessment";
export type ResourceKind = "link" | "file" | "doc";
export type TemplateKind = "project" | "lesson";

export interface Project {
  id: string;
  slug: string;
  grade: string;
  kit: string | null;
  order: number;
  status: ContentStatus;
  lang: Lang;
  title: string | null;
  summary: string | null;
  langs: Lang[];
  updated_at: string;
}

export interface MomentSummary {
  id: string;
  type: string;
  order: number;
  title: string | null;
  blocks: number;
  langs: Lang[];
}

export interface ProjectDetail extends Project {
  moments: MomentSummary[];
}

export interface Block {
  id: string;
  moment_id: string;
  kind: "text" | "image" | "audio" | "video" | "embed";
  order: number;
  media_asset_id: string | null;
  config: Record<string, unknown>;
  lang: Lang;
  body: string | null;
  caption: string | null;
  alt_text: string | null;
  langs: Lang[];
  updated_at: string;
}

/** Lo que devuelve `GET /studio/catalog/moments/{id}/preview`: el momento tal
 *  y como lo sirve el camino de lectura, con `teacher_note` sólo si `as=teacher`
 *  y las URLs de media ya resueltas. */
export interface PreviewMoment {
  id: string;
  type: string;
  order: number;
  title: string | null;
  chatbot_opening_prompt: string | null;
  teacher_note?: string | null;
  lang: Lang;
  blocks: PreviewBlock[];
}

export interface PreviewBlock {
  id: string;
  kind: "text" | "image" | "audio" | "video" | "embed";
  order: number;
  media_asset_id?: string | null;
  config?: Record<string, unknown>;
  body: string | null;
  caption: string | null;
  alt_text: string | null;
  url?: string | null;
  mime_type?: string | null;
  duration_seconds?: number | null;
}

export interface Moment {
  id: string;
  project_id: string;
  type: string;
  order: number;
  lang: Lang;
  title: string | null;
  teacher_note: string | null;
  chatbot_opening_prompt: string | null;
  langs: Lang[];
  updated_at: string;
  blocks: Block[];
}

export interface TranslationState {
  lang: Lang;
  complete: boolean;
  missing: string[];
}

export interface Lesson {
  id: string;
  slug: string;
  area: string;
  grade: string | null;
  status: ContentStatus;
  estimated_minutes: number | null;
  lang: Lang;
  title: string | null;
  summary: string | null;
  body: string | null;
  langs: Lang[];
  updated_at: string;
}

export interface Resource {
  id: string;
  slug: string;
  area: string;
  kind: ResourceKind;
  status: ContentStatus;
  url: string | null;
  media_asset_id: string | null;
  lang: Lang;
  title: string | null;
  description: string | null;
  langs: Lang[];
  updated_at: string;
}

export interface PathItem {
  id: string;
  order: number;
  ref_type: RefType;
  ref_id: string;
}

export interface LearningPath {
  id: string;
  slug: string;
  grade: string | null;
  status: ContentStatus;
  lang: Lang;
  title: string | null;
  description: string | null;
  langs: Lang[];
  items: PathItem[];
  updated_at: string;
}

export interface ContentTemplate {
  id: string;
  slug: string;
  kind: TemplateKind;
  name: string;
  description: string | null;
  payload: Record<string, unknown>;
  created_by: string | null;
  updated_at: string;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  used_in: number;
}

export interface CollectionItem {
  id: string;
  order: number;
  target_type: RefType;
  target_id: string;
}

export interface Collection {
  id: string;
  slug: string;
  lang: Lang;
  title: string | null;
  description: string | null;
  langs: Lang[];
  items: CollectionItem[];
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  s3_key: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  original_filename: string;
  duration_seconds: number | null;
  alt_text: string | null;
  created_at: string;
  used_in: number;
}

export interface MediaList {
  total: number;
  items: MediaAsset[];
}

export interface Dashboard {
  content: {
    projects: { total: number; published: number };
    lessons: { total: number; published: number };
    resources: number;
    paths: number;
    collections: number;
  };
  students_impacted: number;
  performance: {
    submitted_attempts: number;
    avg_score: number | null;
    completed_moments: number;
  };
  recent: RecentItem[];
}

export interface RecentItem {
  id: string;
  type: "project" | "lesson";
  title: string;
  area: string | null;
  status: ContentStatus;
  updated_at: string;
}

export interface AssessmentAnalyticsRow {
  assessment_id: string;
  project_id: string;
  attempts: number;
  avg_score: number | null;
}

export interface StudentActivity {
  id: string;
  full_name: string;
  email: string;
  grade: string | null;
  is_active: boolean;
  completed_moments: number;
  attempts: number;
  last_activity: string | null;
}

export interface Assessment {
  id: string;
  moment_id: string;
  max_attempts: number;
  pass_score: number;
  team_mode: boolean;
  questions: Question[];
}

export interface Question {
  id: string;
  kind: "mcq" | "true_false" | "open" | "numeric";
  order: number;
  points: number;
  correct_numeric: number | null;
  prompt: string | null;
  choices: Choice[];
}

export interface Choice {
  id: string;
  order: number;
  is_correct: boolean;
  label: string | null;
}
