import type { ProjectAnnouncement } from "@/routes/_collab.announcements";

/** Forme minimale d'une annonce de recrutement Studio (stockée dans le projet). */
export type StudioRecruitLike = {
  id: string;
  title?: string;
  hook?: string;
  language?: string;
  role: string;
  status: string; // "Ouverte" | "Brouillon"
  description: string;
  commitment: string;
  compensation?: string;
  remunerated: boolean;
  created: string;
};

/** Annonce de recrutement Studio → annonce « projet » (rendu identique à la page Annonces). */
export function projectAnnouncementFromRecruit(
  r: StudioRecruitLike,
  ctx: {
    projectName: string;
    projectId?: string;
    ownerId?: string;
    genre?: string;
    subgenres?: string[];
    cover?: string;
    language?: string;
  },
): ProjectAnnouncement {
  return {
    kind: "project",
    id: r.id,
    ownerId: ctx.ownerId,
    projectId: ctx.projectId,
    title: r.title || (r.role ? `Recherche ${r.role}` : "Annonce de recrutement"),
    projectName: ctx.projectName,
    cover: ctx.cover,
    description: r.hook || r.description,
    roleNeeded: r.role,
    remuneration: r.remunerated,
    engagement: r.commitment === "Ponctuel" ? "Ponctuel" : "Long terme",
    genre: ctx.genre ?? "Shonen",
    mode: r.remunerated ? "Rémunéré" : "Non rémunéré",
    availability: "",
    status: r.status === "Ouverte" ? "Open" : "Draft",
    language: r.language || ctx.language || "FR",
    experience: "",
    requiredSkills: ctx.subgenres ?? [],
    fullDescription: r.description,
    requirements: "",
    contribution: "",
    team: "",
    application: "",
  };
}
