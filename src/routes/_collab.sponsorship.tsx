import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Send, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANNOUNCEMENTS, type Announcement, type AnnouncementMode } from "@/lib/sponsorship-data";
import { listSponsorOptions, subscribeSponsorOptions } from "@/lib/sponsorship-options";
import { announcementFromOption } from "@/lib/sponsorship-map";
import { btnSecondary, inputCls, metaLabel } from "@/components/sponsorship/ui";
import { AnnouncementCard, CardSkeleton } from "@/components/sponsorship/AnnouncementCard";
import { DetailDialog } from "@/components/sponsorship/DetailDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendSponsorshipContact } from "@/lib/user-workflows";
import { useI18n } from "@/lib/i18n";
import { loadStudioProjects } from "@/lib/studio-projects";
import { listFavorites, setFavorite } from "@/lib/favorites";
import { getSupabase } from "@/lib/supabase";
import {
  createSponsorship,
  formatMoney,
  type PaymentType,
  type Platform as SponsorshipPlatform,
  type Service,
} from "@/features/sponsorships/store";
import {
  AdvancedFiltersDialog,
  emptyFilters,
  SPONSOR_TYPES,
  type SponsorFilters,
} from "@/components/sponsorship/AdvancedFiltersDialog";

export const Route = createFileRoute("/_collab/sponsorship")({
  component: SponsorshipPage,
});

type StudioProjectOption = { id: string; title: string };

function SponsorshipPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<AnnouncementMode>("creator");
  const [search, setSearch] = useState("");
  const [userAnnouncements, setUserAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => void listSponsorOptions()
      .then((options) => { if (active) setUserAnnouncements(options.map(announcementFromOption)); })
      .catch(() => { if (active) setUserAnnouncements([]); });
    refresh();
    const unsubscribe = subscribeSponsorOptions(() => { if (active) refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const [filters, setFilters] = useState<SponsorFilters>(emptyFilters);

  const [detail, setDetail] = useState<Announcement | null>(null);
  const [contactFor, setContactFor] = useState<Announcement | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listFavorites()
      .then((favorites) => {
        const titles = new Set(
          favorites.filter((favorite) => favorite.kind === "Sponsorship option").map((favorite) => favorite.title),
        );
        setSaved(Object.fromEntries(userAnnouncements.map((item) => [item.id, titles.has(item.title)])));
      })
      .catch(() => setSaved({}));
  }, [userAnnouncements]);

  const toggleSaved = async (announcement: Announcement) => {
    const next = !saved[announcement.id];
    await setFavorite("Sponsorship option", announcement.title, next);
    setSaved((current) => ({ ...current, [announcement.id]: next }));
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [mode]);

  const resetFilters = () => {
    setSearch("");
    setFilters(emptyFilters);
  };

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (search) chips.push({ key: "search", label: `${t("sponsor.searchChip")} ${search}`, clear: () => setSearch("") });

    const arrayFields: (keyof SponsorFilters)[] = [
      "sponsorTypes",
      "videoTypes",
      "durations",
      "genres",
      "subGenres",
      "platforms",
      "paymentModes",
    ];
    arrayFields.forEach((key) => {
      (filters[key] as string[]).forEach((v) =>
        chips.push({
          key: `${key}-${v}`,
          label: v,
          clear: () => setFilters((f) => ({ ...f, [key]: (f[key] as string[]).filter((x) => x !== v) })),
        }),
      );
    });

    const numFields: [keyof SponsorFilters, string][] = [
      ["minPrice", t("sponsor.priceMin")],
      ["maxPrice", t("sponsor.priceMax")],
      ["minChapters", t("sponsor.chipMinChapters")],
      ["maxChapters", t("sponsor.chipMaxChapters")],
      ["minSubs", t("sponsor.chipMinSubs")],
      ["maxSubs", t("sponsor.chipMaxSubs")],
    ];
    numFields.forEach(([key, lbl]) => {
      const val = filters[key] as string;
      if (val) chips.push({ key, label: `${lbl} ${val}`, clear: () => setFilters((f) => ({ ...f, [key]: "" })) });
    });

    return chips;
  }, [search, filters, t]);

  // normalisation plateforme ("Youtube" ≈ "YouTube", "Twitter" ≈ "Twitter / X")
  const normPlatform = (p: string) => p.toLowerCase().replace(/[^a-z]/g, "");

  const results = useMemo(() => {
    const minP = Number(filters.minPrice) || 0;
    const maxP = Number(filters.maxPrice) || 0;
    const minC = Number(filters.minChapters) || 0;
    const maxC = Number(filters.maxChapters) || 0;
    const minS = Number(filters.minSubs) || 0;
    const maxS = Number(filters.maxSubs) || 0;

    return [...userAnnouncements, ...ANNOUNCEMENTS].filter((a) => a.mode === mode).filter((a) => {
      if (search && !`${a.title} ${a.ownerName} ${a.shortDescription}`.toLowerCase().includes(search.toLowerCase())) return false;

      // prix (bornes de l'annonce vs bornes du filtre)
      if (minP > 0 && (a.priceMax ?? 0) < minP) return false;
      if (maxP > 0 && (a.priceMin ?? Infinity) > maxP) return false;

      // type de parrainage / type de vidéo / durée
      if (filters.sponsorTypes.length && !filters.sponsorTypes.includes(a.sponsorshipType)) return false;
      if (filters.videoTypes.length && (!a.videoType || !filters.videoTypes.includes(a.videoType))) return false;
      if (filters.durations.length && (!a.duration || !filters.durations.includes(a.duration))) return false;

      // projet : genre (démographie) + chapitres — les annonces n'ont pas de sous-genre
      if (filters.genres.length && !filters.genres.includes(a.category)) return false;
      if (minC > 0 && (a.chapters ?? 0) < minC) return false;
      if (maxC > 0 && (a.chapters ?? Infinity) > maxC) return false;

      // créateur : plateformes + mode de paiement + abonnés
      if (filters.platforms.length) {
        const have = a.platforms.map(normPlatform);
        if (!filters.platforms.some((p) => have.some((h) => h.startsWith(normPlatform(p))))) return false;
      }
      if (filters.paymentModes.length && !filters.paymentModes.includes(a.paymentMode)) return false;
      if (filters.languages.length && !filters.languages.includes(a.language ?? "FR")) return false;
      if (minS > 0 && (a.subscribers ?? 0) < minS) return false;
      if (maxS > 0 && (a.subscribers ?? Infinity) > maxS) return false;

      return true;
    });
  }, [mode, search, filters, userAnnouncements]);

  return (
    <div className="min-h-screen bg-cm-bg font-manrope text-cm-text">
      <div className="mx-auto max-w-[1280px] p-4 md:p-6 lg:p-8">
        {/* header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-sora text-[28px] font-bold leading-[36px] text-cm-text">{t("sponsor.title")}</h1>
            <p className="mt-1 font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
              {t("sponsor.subtitle")}
            </p>
          </div>
        </header>

        {/* mode switch */}
        <div className="mt-6 inline-flex gap-2 rounded-full bg-cm-panel p-1">
          {(
            [
              { key: "project", label: t("sponsor.findProject") },
              { key: "creator", label: t("sponsor.findCreator") },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              aria-pressed={mode === opt.key}
              className={cn(
                "h-10 rounded-full px-4 font-manrope text-[14px] font-bold transition-colors",
                mode === opt.key
                  ? "bg-cm-neon text-[#04111e] shadow-[0_6px_18px_rgba(57,255,136,0.25)]"
                  : "border border-[rgba(133,154,206,0.28)] bg-cm-card text-cm-text",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* filter bar: search + price + type de parrainage + advanced filters */}
        <div className="mt-6 rounded-[22px] border border-[rgba(133,154,206,0.18)] bg-cm-panel p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <input
                aria-label={mode === "creator" ? t("sponsor.searchCreator") : t("sponsor.searchProject")}
                className={inputCls}
                placeholder={mode === "creator" ? `${t("sponsor.searchCreator")}…` : `${t("sponsor.searchProject")}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                aria-label={t("sponsor.priceMinAria")}
                className={cn(inputCls, "w-24")}
                placeholder={t("sponsor.priceMin")}
                inputMode="numeric"
                value={filters.minPrice}
                onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
              />
              <span className="text-cm-muted">–</span>
              <input
                aria-label={t("sponsor.priceMaxAria")}
                className={cn(inputCls, "w-24")}
                placeholder={t("sponsor.priceMax")}
                inputMode="numeric"
                value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
              />
            </div>

            <button type="button" className={btnSecondary} onClick={() => setAdvancedOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" /> {t("sponsor.advancedFilters")}
              {activeFilters.length > 0 && (
                <span className="ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-cm-neon px-1.5 text-[11px] font-extrabold text-[#04111e]">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          {/* Type de parrainage — filtre de base */}
          <div className="mt-3">
            <div className={cn(metaLabel, "mb-2")}>{t("sponsor.sponsorType")}</div>
            <div className="flex flex-wrap gap-2">
              {SPONSOR_TYPES.map((t) => {
                const active = filters.sponsorTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        sponsorTypes: active ? f.sponsorTypes.filter((x) => x !== t) : [...f.sponsorTypes, t],
                      }))
                    }
                    className={cn(
                      "rounded-full px-3 py-1.5 font-manrope text-[13px] font-medium transition-colors",
                      active
                        ? "border border-transparent bg-cm-neon text-[#04111e]"
                        : "border border-[rgba(133,154,206,0.18)] bg-cm-input text-cm-text2 hover:border-[rgba(133,154,206,0.40)]",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* active filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={metaLabel}>{t("sponsor.activeFilters")}</span>
          {activeFilters.length === 0 ? (
            <span className="font-manrope text-[13px] font-medium text-cm-muted">{t("sponsor.noActiveFilters")}</span>
          ) : (
            <>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={f.clear}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(57,255,136,0.12)] border border-[rgba(57,255,136,0.45)] px-3 py-1 font-manrope text-[13px] font-medium text-cm-neon"
                >
                  {f.label}
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">{t("sponsor.removeFilter")}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="font-manrope text-[13px] font-bold text-cm-text2 underline-offset-2 hover:text-cm-text hover:underline"
              >
                {t("sponsor.resetAll")}
              </button>
            </>
          )}
        </div>

        {/* grid */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-[22px] border border-[rgba(133,154,206,0.18)] bg-cm-panel p-10 text-center">
              <h2 className="font-sora text-[18px] font-bold leading-[26px] text-cm-text">
                {t("sponsor.noResults")}
              </h2>
              <p className="mx-auto mt-2 max-w-md font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                {t("sponsor.noResultsText")}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button type="button" className={btnSecondary} onClick={resetFilters}>
                  {t("sponsor.resetFilters")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {results.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  a={a}
                  saved={!!saved[a.id]}
                  onToggleSave={() => void toggleSaved(a)}
                  onViewDetails={() => setDetail(a)}
                  onContact={() => setContactFor(a)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DetailDialog
        announcement={detail}
        saved={detail ? !!saved[detail.id] : false}
        onToggleSave={detail ? () => void toggleSaved(detail) : undefined}
        onOpenChange={(o) => !o && setDetail(null)}
        onContact={(announcement) => {
          setDetail(null);
          setContactFor(announcement);
        }}
      />
      <SponsorshipContactDialog
        announcement={contactFor}
        onOpenChange={(open) => !open && setContactFor(null)}
        onDone={(message) => {
          setContactFor(null);
          setFeedback(message);
          window.setTimeout(() => setFeedback(null), 3200);
        }}
      />
      <AdvancedFiltersDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        mode={mode}
        filters={filters}
        setFilters={setFilters}
        onReset={resetFilters}
      />
      {feedback && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-[18px] border border-[rgba(57,255,136,0.45)] bg-cm-panel px-4 py-3 font-manrope text-[13px] font-bold text-cm-text shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          {feedback}
        </div>
      )}
    </div>
  );
}

export function SponsorshipContactDialog({
  announcement,
  onOpenChange,
  onDone,
}: {
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const { t } = useI18n();
  const [linked, setLinked] = useState("");
  const [projects, setProjects] = useState<StudioProjectOption[]>([]);
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const a = announcement;
  const isProjectAnnouncement = a?.mode === "project";

  useEffect(() => {
    if (!a) return;
    setLinked(a.mode === "project" ? t("sponsor.linkedProjectDefault") : t("sponsor.linkedCreatorDefault"));
    setBudget(a.price ?? "");
    setMessage("");
    setError("");
    setSending(false);
    if (a.mode === "creator") {
      void loadStudioProjects<StudioProjectOption>()
        .then((rows) => {
          setProjects(rows);
          setLinked((current) => rows.find((project) => project.title === current)?.title || rows[0]?.title || current);
        })
        .catch(() => setProjects([]));
    }
  }, [a, t]);

  const submit = async () => {
    if (!a) return;
    if (!linked.trim()) {
      setError(isProjectAnnouncement ? t("sponsor.errorProfile") : t("sponsor.errorProject"));
      return;
    }
    if (!message.trim()) {
      setError(t("sponsor.errorMessage"));
      return;
    }
    setSending(true);
    setError("");
    try {
      let sponsorshipId: string | undefined;
      if (a.mode === "creator") {
        const selectedProject = projects.find((project) => project.title === linked.trim());
        if (!selectedProject) throw new Error("Sélectionne un projet existant.");
        const amount = Number((budget || a.price || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        const service: Service = {
          id: `sv-${crypto.randomUUID()}`,
          name: a.sponsorshipType,
          format: a.videoType || a.sponsorshipType,
          duration: a.duration || "A definir",
          platforms: a.platforms
            .map((platform) => (platform === "Twitter / X" ? "Twitter/X" : platform))
            .filter((platform): platform is SponsorshipPlatform =>
              ["TikTok", "YouTube", "Instagram", "Twitter/X", "Other"].includes(platform),
            ),
          quantity: 1,
          price: amount,
          paymentType: a.paymentMode.toLocaleLowerCase().includes("abonnement")
            ? ("subscription" as PaymentType)
            : ("one_time" as PaymentType),
          notes: a.fullDescription,
        };
        const sponsorship = await createSponsorship({
          name: `${linked.trim()} - ${a.ownerName}`,
          project: linked.trim(),
          projectId: selectedProject.id,
          creator: a.ownerName,
          creatorId: a.ownerId,
          totalPrice: amount,
          currency: "EUR",
          status: "pending",
          paymentType: service.paymentType,
          notes: message.trim(),
          conditions: "En attente de validation par le créateur de contenu.",
          services: [service],
          participants: [
            {
              id: a.ownerId || a.ownerName,
              name: a.ownerName,
              role: "creator",
              meta: "Créateur de contenu",
              initials: a.ownerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CM",
            },
          ],
        });
        sponsorshipId = sponsorship.id;
      } else {
        if (!a.projectId) throw new Error("Le projet lie a cette annonce est introuvable.");
        const sb = getSupabase();
        const uid = (await sb.auth.getSession()).data.session?.user.id;
        if (!uid) throw new Error("Connecte-toi pour envoyer une candidature.");
        const { data: profile, error: profileError } = await sb
          .from("profiles")
          .select("display_name, username")
          .eq("id", uid)
          .single();
        if (profileError) throw new Error(profileError.message);
        const creatorName = profile.display_name || profile.username || "Createur de contenu";
        const amount = Number((budget || a.price || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        const service: Service = {
          id: `sv-${crypto.randomUUID()}`,
          name: a.sponsorshipType,
          format: a.videoType || a.sponsorshipType,
          duration: a.duration || "A definir",
          platforms: a.platforms
            .map((platform) => (platform === "Twitter / X" ? "Twitter/X" : platform))
            .filter((platform): platform is SponsorshipPlatform =>
              ["TikTok", "YouTube", "Instagram", "Twitter/X", "Other"].includes(platform),
            ),
          quantity: 1,
          price: amount,
          paymentType: a.paymentMode.toLocaleLowerCase().includes("abonnement")
            ? ("subscription" as PaymentType)
            : ("one_time" as PaymentType),
          notes: a.fullDescription,
        };
        const sponsorship = await createSponsorship({
          name: `${a.ownerName} - ${creatorName}`,
          project: a.ownerName,
          projectId: a.projectId,
          creator: creatorName,
          creatorId: uid,
          totalPrice: amount,
          currency: "EUR",
          status: "pending",
          paymentType: service.paymentType,
          notes: message.trim(),
          conditions: "En attente de validation par le projet.",
          services: [service],
          participants: [
            {
              id: uid,
              name: creatorName,
              role: "creator",
              meta: "Createur de contenu",
              initials: creatorName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase() || "CM",
            },
          ],
        });
        sponsorshipId = sponsorship.id;
        setLinked(creatorName);
      }
      if (!a.ownerId) throw new Error("Le propriétaire de cette annonce est introuvable.");
      await sendSponsorshipContact({
        sponsorshipId,
        announcementTitle: a.title,
        announcementMode: a.mode,
        owner: a.ownerId || a.ownerName,
        linked,
        budgetOrPrice: budget || a.price || (a.mode === "creator" ? formatMoney(0, "EUR") : t("sponsor.budgetTBD")),
        sponsorshipType: a.sponsorshipType,
        message,
      });
      onDone(isProjectAnnouncement ? t("sponsor.sentProject") : t("sponsor.sentCreator"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "La demande n'a pas pu être envoyée.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!a} onOpenChange={onOpenChange}>
      <DialogContent className="border-[rgba(133,154,206,0.28)] bg-cm-panel text-cm-text sm:max-w-[620px]">
        {a && (
          <>
            <DialogHeader>
              <DialogTitle className="font-sora text-[22px] font-bold">
                {isProjectAnnouncement ? t("sponsor.replyProject") : t("sponsor.contactCreator")}
              </DialogTitle>
              <DialogDescription className="font-manrope text-cm-text2">
                {a.title} · {a.ownerName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className={cn(metaLabel, "mb-2 block")}>
                  {isProjectAnnouncement ? t("sponsor.creatorProfile") : t("sponsor.mangaToPromote")}
                </label>
                {!isProjectAnnouncement && projects.length > 0 ? (
                  <select className={inputCls} value={linked} onChange={(event) => setLinked(event.target.value)}>
                    {projects.map((project) => (
                      <option key={project.id} value={project.title}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputCls}
                    value={linked}
                    onChange={(event) => setLinked(event.target.value)}
                    placeholder={isProjectAnnouncement ? t("sponsor.creatorPlaceholder") : t("sponsor.projectPlaceholder")}
                    disabled={!isProjectAnnouncement && projects.length > 0}
                  />
                )}
              </div>

              <div>
                <label className={cn(metaLabel, "mb-2 block")}>
                  {isProjectAnnouncement ? t("sponsor.proposedRate") : t("sponsor.budgetSlot")}
                </label>
                <input
                  className={inputCls}
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder={isProjectAnnouncement ? t("sponsor.ratePlaceholder") : t("sponsor.budgetPlaceholder")}
                />
              </div>

              <div>
                <label className={cn(metaLabel, "mb-2 block")}>{t("sponsor.message")}</label>
                <textarea
                  className="min-h-[128px] w-full resize-y rounded-[14px] border border-[rgba(133,154,206,0.20)] bg-cm-input px-[14px] py-3 font-manrope text-[14px] font-medium text-cm-text outline-none placeholder:text-cm-muted focus:border-cm-neon focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={
                    isProjectAnnouncement
                      ? t("sponsor.messageProjectPlaceholder")
                      : t("sponsor.messageCreatorPlaceholder")
                  }
                />
              </div>

              {error && (
                <p className="rounded-[12px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-3 py-2 font-manrope text-[13px] font-semibold text-[#ff5f7e]">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
              <button type="button" className={btnSecondary} onClick={() => onOpenChange(false)}>
                {t("sponsor.cancel")}
              </button>
              <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-cm-neon px-[18px] font-manrope text-[14px] font-bold text-[#04111e] transition-colors hover:bg-cm-neon-hover disabled:opacity-60" onClick={() => void submit()} disabled={sending}>
                <Send className="h-4 w-4" />
                {sending ? "Envoi..." : t("sponsor.send")}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
