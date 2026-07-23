import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Announcement } from "@/lib/sponsorship-data";
import {
  btnPrimary,
  btnSecondary,
  Chip,
  PlatformChip,
  AvailabilityChip,
  Thumb,
} from "./ui";
import { listSponsorshipReviews, type SponsorshipReview } from "@/lib/sponsorship-reviews";

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[18px] border border-[rgba(133,154,206,0.18)] bg-cm-details p-5 ${className}`}>
      <h3 className="font-sora text-[16px] font-bold leading-[24px] text-cm-text">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5 text-cm-neon" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className="h-3.5 w-3.5"
          fill={star <= value ? "currentColor" : "none"}
          strokeWidth={1.8}
        />
      ))}
    </div>
  );
}

export function DetailDialog({
  announcement,
  onOpenChange,
  onContact,
  hideActions = false,
  saved = false,
  onToggleSave,
}: {
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
  onContact: (announcement: Announcement) => void;
  /** Masque les boutons Apply/Contact + Save (vue lecture seule, ex. depuis un projet). */
  hideActions?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const a = announcement;
  const [reviews, setReviews] = useState<SponsorshipReview[]>([]);

  useEffect(() => {
    if (!a?.ownerId || a.mode !== "creator") {
      setReviews([]);
      return;
    }
    void listSponsorshipReviews(a.ownerId).then(setReviews).catch(() => setReviews([]));
  }, [a?.ownerId, a?.mode]);

  return (
    <Dialog open={!!a} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-none gap-0 border-[rgba(133,154,206,0.28)] bg-cm-panel p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)] w-[95vw] max-w-[1320px] max-h-[calc(100dvh-16px)] sm:max-h-[85vh] rounded-[24px] overflow-hidden text-cm-text">
        {a && (
          <ScrollArea className="max-h-[calc(100dvh-16px)] sm:max-h-[85vh]">
            <div
              className={`grid gap-5 p-6 ${
                a.mode === "creator"
                  ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(260px,2fr)]"
                  : "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
              }`}
            >
              <aside>
                <SectionCard title={a.mode === "project" ? "Informations du projet" : "Createur de contenu"}>
                  {a.mode === "creator" ? (
                    <CreatorIdentityHero announcement={a} />
                  ) : (
                    <Thumb
                      accent={a.accent}
                      label="Projet"
                      className="h-40 rounded-[18px]"
                      platforms={a.platforms}
                    />
                  )}
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-cm-muted">
                    {a.mode === "project" ? "Projet a promouvoir" : "Profil createur"}
                  </p>
                  <h3 className="mt-1 font-sora text-[20px] font-bold leading-[28px] text-cm-text">{a.ownerName}</h3>
                  <p className="mt-3 font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                    {a.mode === "project"
                      ? "Projet manga cherchant a structurer une collaboration de parrainage."
                      : "Createur de contenu disponible pour presenter et promouvoir des projets manga."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {a.category && <Chip>{a.category}</Chip>}
                    {a.platforms.slice(0, 3).map((p) => <PlatformChip key={p} platform={p} />)}
                  </div>
                </SectionCard>
              </aside>

              <SectionCard title="Informations du parrainage" className="space-y-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AvailabilityChip available={a.status !== "closing"} />
                  <Chip>{a.sponsorshipType}</Chip>
                </div>
                <DialogTitle className="font-sora text-[28px] font-bold leading-[36px] text-cm-text">
                  {a.title}
                </DialogTitle>
                <p className="font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                  {a.fullDescription}
                </p>

                {!hideActions && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-[rgba(133,154,206,0.18)] pt-5">
                    <button type="button" className={btnPrimary} onClick={() => onContact(a)}>
                      {a.mode === "project" ? "Apply" : "Contact"}
                    </button>
                    <button type="button" className={btnSecondary} onClick={onToggleSave}>
                      {saved ? "Enregistré" : "Save"}
                    </button>
                  </div>
                )}
              </SectionCard>

              {a.mode === "creator" && (
                <SectionCard title="Avis des partenariats">
                  <div className="space-y-3">
                    {reviews.length === 0 && (
                      <p className="font-manrope text-[13px] text-cm-muted">Aucun avis pour le moment.</p>
                    )}
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-[14px] border border-[rgba(133,154,206,0.18)] bg-cm-panel p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-manrope text-[12px] font-bold text-cm-text">{review.reviewerName}</p>
                          <RatingStars value={review.rating} />
                        </div>
                        <p className="mt-2 font-manrope text-[13px] font-medium leading-[20px] text-cm-text2">
                          {review.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatorIdentityHero({ announcement }: { announcement: Announcement }) {
  const initials = announcement.ownerName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CM";

  return (
    <div className="relative h-40 overflow-hidden rounded-[18px] bg-cm-details">
      {announcement.ownerBannerUrl ? (
        <img src={announcement.ownerBannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 120% at 15% 10%, color-mix(in oklab, ${announcement.accent} 22%, transparent), transparent 55%), linear-gradient(135deg, #0a1330, #060d22)`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-[#050b1d]/35" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-cm-neon bg-cm-panel shadow-[0_14px_36px_rgba(0,0,0,0.38)]">
          {announcement.ownerAvatarUrl ? (
            <img src={announcement.ownerAvatarUrl} alt={announcement.ownerName} className="h-full w-full object-cover" />
          ) : (
            <span className="font-sora text-[22px] font-extrabold text-cm-neon">{initials}</span>
          )}
        </div>
      </div>
    </div>
  );
}
