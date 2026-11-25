import type { LearningMaterial, MaterialFlag } from "../../../types";

export { avatarUrl } from "../../../utils/avatar";

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  studentId: string;
  dateEnrolled: string;
  department?: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  studentId?: string | null;
}

export type TabKey = "people" | "materials" | "quizzes" | "announcements" | "grades";

export const flagsForMaterial = (id: string, flags: MaterialFlag[]): MaterialFlag[] =>
  flags.filter((f) => f.materialId === id);

export const resolveFileUrl = (mat: LearningMaterial): string | null => {
  const url = mat.fileUrl;
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return `/${url.replace(/^\.?\//, "")}`;
};

export const isRenderable = (mat: LearningMaterial): boolean => {
  const ext = (mat.fileType || "").toLowerCase().replace(/^\./, "");
  return ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "mp4", "webm", "ogg", "mov"].includes(ext);
};

export const isAiMaterial = (mat: LearningMaterial | null): boolean =>
  !!mat && (mat.fileType || "").toLowerCase().startsWith("ai-");

export const groupAttemptsByQuiz = <T extends { id: string; quizTitle: string }>(attempts: T[]) => {
  const groups: { title: string; entries: T[] }[] = [];
  for (const att of attempts) {
    let g = groups.find((x) => x.title === att.quizTitle);
    if (!g) {
      g = { title: att.quizTitle, entries: [] };
      groups.push(g);
    }
    g.entries.push(att);
  }
  return groups;
};

export const downloadLabel = (material: LearningMaterial): string => {
  const ext = (material.fileType || "").toLowerCase().replace(/^\./, "");
  if (ext === "pdf") return "Download PDF";
  if (ext === "doc" || ext === "docx") return `Download ${ext.toUpperCase()}`;
  if (ext === "ppt" || ext === "pptx") return `Download ${ext.toUpperCase()}`;
  if (ext === "txt") return "Download TXT";
  return `Download ${ext.toUpperCase() || "FILE"}`;
};
