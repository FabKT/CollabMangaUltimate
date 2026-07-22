import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Play, ArrowLeft, BookOpen, Megaphone, Handshake, Users, Star } from "lucide-react";
import { loadPublicStudioProjects } from "@/lib/studio-projects";
import { ProjectCard, DetailsModal, AnnouncementWorkflowModal, type ProjectAnnouncement } from "./_collab.announcements";
import { projectAnnouncementFromRecruit } from "@/lib/recruit-map";
import { AnnouncementCard } from "@/components/sponsorship/AnnouncementCard";
import { DetailDialog } from "@/components/sponsorship/DetailDialog";
import { announcementFromOption } from "@/lib/sponsorship-map";
import { listSponsorOptions } from "@/lib/sponsorship-options";
import { getMangaRating } from "@/lib/manga-ratings";
import { SponsorshipContactDialog } from "./_collab.sponsorship";
import type { Announcement } from "@/lib/sponsorship-data";
import { useI18n } from "@/lib/i18n";

type StudioCollaborator = { id: string; name: string; role: string; level: string };

/** Projet Studio lisible depuis le catalogue. */
type StudioReadableProject = {
  id: string;
  title: string;
  synopsis: string;
  status: string;
  genres: string[];
  subgenres?: string[];
  coverDataUrl?: string;
  catalogVisible?: boolean;
  ownerId?: string;
  creator?: string;
  language?: string;
  chapters: {
    id: string;
    number: number;
    title: string;
    status: string;
    pages: { id: string; candidates: { id: string; image?: string }[]; validatedCandidateId: string | null }[];
  }[];
  recruits?: {
    id: string; role: string; status: string; description: string;
    commitment: string; compensation?: string; remunerated: boolean; created: string;
  }[];
  collaborators?: StudioCollaborator[];
};

type MangaTab = "chapters" | "recrutement" | "parrainage" | "collaborateurs";

export const Route = createFileRoute("/_collab/manga/$id/")({
  loader: ({ params }) => ({ id: params.id }),
  head: () => ({ meta: [{ title: "Manga — CollabManga" }] }),
  notFoundComponent: NotFound,
  component: MangaDetailSwitch,
});

function MangaDetailSwitch() {
  const { t } = useI18n();
  const { id } = Route.useLoaderData() as { id: string };
  const [studio, setStudio] = useState<StudioReadableProject | null | "loading">("loading");

  useEffect(() => {
    void loadPublicStudioProjects<StudioReadableProject>()
      .then((rows) => setStudio(rows.find((p) => p.id === id && p.catalogVisible) ?? null))
      .catch(() => setStudio(null));
  }, [id]);

  if (studio === "loading") {
    return (
      <div className="mx-auto max-w-[600px] px-6 py-16 text-center text-[14px] text-[color:var(--color-text-secondary)]">
        {t("mangaDetail.loading")}
      </div>
    );
  }
  if (!studio) return <NotFound />;
  return <StudioMangaDetail project={studio} />;
}

function StudioMangaDetail({ project }: { project: StudioReadableProject }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<MangaTab>("chapters");
  const [viewRecruit, setViewRecruit] = useState<ProjectAnnouncement | null>(null);
  const [applyRecruit, setApplyRecruit] = useState<ProjectAnnouncement | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [viewSponsor, setViewSponsor] = useState<Announcement | null>(null);
  const [contactSponsor, setContactSponsor] = useState<Announcement | null>(null);
  const [savedSponsor, setSavedSponsor] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState(0);

  useEffect(() => {
    void getMangaRating(project.id).then(setRating).catch(() => setRating(0));
  }, [project.id]);

  const published = project.chapters.filter((c) => c.status === "Published");

  // Annonces de recrutement visibles du projet → rendu identique à la page Annonces.
  const recruits: ProjectAnnouncement[] = useMemo(
    () =>
      (project.recruits ?? [])
        .filter((r) => r.status === "Ouverte")
        .map((r) =>
          projectAnnouncementFromRecruit(r, {
            projectName: project.title,
            genre: project.genres[0],
            subgenres: project.subgenres,
            cover: project.coverDataUrl,
          }),
        ),
    [project],
  );

  // Annonces de parrainage du projet → rendu identique à la page Sponsoring.
  const [sponsors, setSponsors] = useState<Announcement[]>([]);
  useEffect(() => {
    void listSponsorOptions()
      .then((options) =>
        setSponsors(
          options
            .filter((option) => option.mode === "project" && option.ownerName === project.title)
            .map(announcementFromOption),
        ),
      )
      .catch(() => setSponsors([]));
  }, [project.title]);

  const collaborators = project.collaborators ?? [];

  const TABS: { id: MangaTab; label: string; icon: typeof BookOpen; count: number }[] = [
    { id: "chapters", label: t("mangaDetail.tabChapters"), icon: BookOpen, count: published.length },
    { id: "recrutement", label: t("mangaDetail.tabRecruitment"), icon: Megaphone, count: recruits.length },
    { id: "parrainage", label: t("mangaDetail.tabSponsorship"), icon: Handshake, count: sponsors.length },
    { id: "collaborateurs", label: t("mangaDetail.tabCollaborators"), icon: Users, count: collaborators.length },
  ];

  const panel = { background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: 28 } as const;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mb-6">
        <Link to="/manga" className="btn-ghost -ml-3 h-10">
          <ArrowLeft className="h-4 w-4" /> {t("mangaDetail.backToCatalog")}
        </Link>
      </div>

      <section className="mb-6 p-6 md:p-8" style={panel}>
        <div className="grid gap-6 md:grid-cols-[minmax(200px,260px)_1fr] md:gap-8">
          <div className="mx-auto w-full max-w-[260px] md:mx-0">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl" style={{ border: "1px solid var(--color-border-default)" }}>
              {project.coverDataUrl ? (
                <img src={project.coverDataUrl} alt={`${project.title} cover`} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[13px] font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]" style={{ background: "linear-gradient(160deg,#0E1736,#050B1D)" }}>
                  {t("mangaDetail.coverPending")}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-active">{project.status}</span>
              <span className="chip-neutral">{project.language || "FR"}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[28px] font-extrabold leading-[36px] md:text-[34px] md:leading-[42px]">
                {project.title}
              </h1>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--star)]">
                <Star className="h-4 w-4 fill-current" /> {rating.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-[13px] font-semibold text-[color:var(--color-text-muted)]">
              {t("catalog.by")} {project.creator || "Créateur CollabManga"}
            </p>
            <p className="mt-4 max-w-3xl text-[15px] leading-[25px] text-[color:var(--color-text-secondary)]">
              {project.synopsis}
            </p>
            <div className="mt-5">
              <p className="meta-label mb-2">{t("mangaDetail.genreSubgenres")}</p>
              <div className="flex flex-wrap gap-1.5">
                {project.genres.map((g) => <span key={g} className="chip-active font-bold">{g}</span>)}
                {(project.subgenres ?? []).map((g) => <span key={g} className="chip-neutral">{g}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Onglets — même design que la page « projet sélectionné » (studio) */}
      <div className="scrollbar-thin mb-6 flex gap-1 overflow-x-auto rounded-[16px] border border-[var(--border-default)] bg-[var(--panel)] p-1.5">
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id;
          const Icon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`inline-flex h-[38px] shrink-0 items-center gap-2 rounded-[12px] px-4 text-[13px] font-bold transition-colors ${active ? "bg-[var(--neon-soft)] text-[var(--neon)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              <Icon className="h-4 w-4" /> {tabItem.label}
            </button>
          );
        })}
      </div>

      {applyNotice && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(57,255,136,0.10)", border: "1px solid rgba(57,255,136,0.35)", color: "#39ff88" }}>
          {applyNotice}
        </div>
      )}

      {tab === "chapters" && (
        <section className="p-6 md:p-8" style={panel}>
          <h2 className="font-display text-[20px] font-extrabold">{t("mangaDetail.publishedChapters")}</h2>
          {published.length === 0 ? (
            <p className="mt-3 text-[14px] text-[color:var(--color-text-secondary)]">{t("mangaDetail.noChapters")}</p>
          ) : (
            <div className="mt-4 grid gap-2">
              {published.map((c) => {
                const readablePages = c.pages.filter(
                  (p) => p.validatedCandidateId && p.candidates.find((cd) => cd.id === p.validatedCandidateId)?.image,
                ).length;
                return (
                  <Link
                    key={c.id}
                    to="/manga/$id/chapter/$chapterId"
                    params={{ id: project.id, chapterId: c.id }}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors hover:border-[color:var(--color-neon,#39ff88)]"
                    style={{ borderColor: "var(--color-border-default)", background: "var(--color-card, rgba(255,255,255,0.02))" }}
                  >
                    <div>
                      <div className="text-[14px] font-bold">Ch. {c.number} — {c.title}</div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">{readablePages} {readablePages > 1 ? t("mangaDetail.readablePages") : t("mangaDetail.readablePage")}</div>
                    </div>
                    <Play className="h-4 w-4 text-[color:var(--color-text-secondary)]" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "recrutement" && (
        <section className="p-6 md:p-8" style={panel}>
          <h2 className="mb-4 font-display text-[20px] font-extrabold">{t("mangaDetail.recruitmentAnnouncements")}</h2>
          {recruits.length === 0 ? (
            <p className="text-[14px] text-[color:var(--color-text-secondary)]">{t("mangaDetail.noRecruitment")}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {recruits.map((a) => (
                <ProjectCard key={a.id} item={a} onView={() => setViewRecruit(a)} onApply={() => setApplyRecruit(a)} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "parrainage" && (
        <section className="p-6 md:p-8" style={panel}>
          <h2 className="mb-4 font-display text-[20px] font-extrabold">{t("mangaDetail.sponsorshipAnnouncements")}</h2>
          {sponsors.length === 0 ? (
            <p className="text-[14px] text-[color:var(--color-text-secondary)]">{t("mangaDetail.noSponsorship")}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {sponsors.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  a={a}
                  saved={!!savedSponsor[a.id]}
                  onToggleSave={() => setSavedSponsor((s) => ({ ...s, [a.id]: !s[a.id] }))}
                  onViewDetails={() => setViewSponsor(a)}
                  onContact={() => setViewSponsor(a)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "collaborateurs" && (
        <section className="p-6 md:p-8" style={panel}>
          <h2 className="mb-4 font-display text-[20px] font-extrabold">{t("mangaDetail.collaborators")}</h2>
          {collaborators.length === 0 ? (
            <p className="text-[14px] text-[color:var(--color-text-secondary)]">{t("mangaDetail.noCollaborators")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collaborators.map((c) => (
                <Link
                  key={c.id}
                  to="/profile/$profileId"
                  params={{ profileId: c.id }}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors hover:border-[color:var(--color-neon,#39ff88)]"
                  style={{ borderColor: "var(--color-border-default)", background: "var(--color-card, rgba(255,255,255,0.02))" }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-bold" style={{ background: "linear-gradient(135deg,#1a2960,#0a1030)", border: "1px solid var(--color-border-default)" }}>
                    {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold">{c.name}</div>
                    <div className="truncate text-[12px] text-[color:var(--color-text-muted)]">{c.role} · {c.level}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {viewRecruit && <DetailsModal item={viewRecruit} hideApply onClose={() => setViewRecruit(null)} />}
      {applyRecruit && (
        <AnnouncementWorkflowModal
          action="apply"
          item={applyRecruit}
          onClose={() => setApplyRecruit(null)}
          onDone={(m) => { setApplyRecruit(null); setApplyNotice(m); }}
        />
      )}
      {viewSponsor && (
        <DetailDialog
          announcement={viewSponsor}
          onOpenChange={(o) => { if (!o) setViewSponsor(null); }}
          onContact={(announcement) => {
            setViewSponsor(null);
            setContactSponsor(announcement);
          }}
        />
      )}
      <SponsorshipContactDialog
        announcement={contactSponsor}
        onOpenChange={(open) => { if (!open) setContactSponsor(null); }}
        onDone={() => setContactSponsor(null)}
      />
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-[600px] px-6 py-16 text-center">
      <h1 className="font-display text-[28px] font-extrabold">{t("mangaDetail.notFound")}</h1>
      <p className="mt-2 text-[14px] text-[color:var(--color-text-secondary)]">
        {t("mangaDetail.notFoundText")}
      </p>
      <div className="mt-6">
        <Link to="/manga" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> {t("mangaDetail.backToCatalog")}
        </Link>
      </div>
    </div>
  );
}
