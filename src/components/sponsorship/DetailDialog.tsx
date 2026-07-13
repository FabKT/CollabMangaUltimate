import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star } from "lucide-react";
import type { ReactNode } from "react";
import type { Announcement } from "@/lib/sponsorship-data";
import { showDuration } from "@/lib/sponsorship-data";
import {
  btnPrimary,
  btnSecondary,
  Chip,
  metaLabel,
  PlatformChip,
  StatusChip,
  Thumb,
} from "./ui";

const CREATOR_REVIEWS = [
  {
    name: "Studio Ronin",
    rating: 5,
    comment: "Livrable propre, timing respecte et integration naturelle dans la video.",
  },
  {
    name: "Moonline Press",
    rating: 4,
    comment: "Bonne comprehension du projet et retour detaille sur les points forts du manga.",
  },
  {
    name: "Hollow Sun Team",
    rating: 5,
    comment: "Campagne efficace, communication claire et audience pertinente.",
  },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={metaLabel}>{label}</p>
      <p className="mt-0.5 font-manrope text-[14px] font-medium leading-[22px] text-cm-text">{value}</p>
    </div>
  );
}

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

function SimpleList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="font-manrope text-[13px] font-medium leading-[20px] text-cm-text2">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function DetailDialog({
  announcement,
  onOpenChange,
  onContact,
}: {
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
  onContact: (announcement: Announcement) => void;
}) {
  const a = announcement;

  return (
    <Dialog open={!!a} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-none gap-0 border-[rgba(133,154,206,0.28)] bg-cm-panel p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)] w-[95vw] max-w-[1120px] max-h-[85vh] rounded-[24px] overflow-hidden text-cm-text">
        {a && (
          <ScrollArea className="max-h-[85vh]">
            <div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <aside className="space-y-5">
                <SectionCard title={a.mode === "project" ? "Informations du projet" : "Createur de contenu"}>
                  <Thumb
                    accent={a.accent}
                    label={a.mode === "project" ? "Projet" : "Profil"}
                    className="h-40 rounded-[18px]"
                    platforms={a.platforms}
                  />
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-cm-muted">
                    {a.mode === "project" ? "Projet a promouvoir" : "Profil createur"}
                  </p>
                  <h3 className="mt-1 font-sora text-[20px] font-bold leading-[28px] text-cm-text">{a.ownerName}</h3>
                  <p className="mt-3 font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                    {a.mode === "project" ? a.fullDescription : a.targetAudience}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip>{a.category}</Chip>
                    {a.platforms.slice(0, 3).map((p) => <PlatformChip key={p} platform={p} />)}
                  </div>

                  {a.mode === "project" && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Row label="Audience cible" value={a.targetAudience} />
                      <Row label="Lien associe" value={a.linked} />
                    </div>
                  )}
                </SectionCard>

                {a.mode === "creator" && (
                  <SectionCard title="Avis de collaborations">
                    <div className="space-y-3">
                      {CREATOR_REVIEWS.map((review) => (
                        <div key={review.name} className="rounded-[14px] border border-[rgba(133,154,206,0.18)] bg-cm-panel p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-manrope text-[12px] font-bold text-cm-text">{review.name}</p>
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
              </aside>

              <SectionCard title="Informations du parrainage" className="space-y-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={a.status} />
                  <Chip>{a.mode === "project" ? "Recherche createur" : "Recherche projet"}</Chip>
                </div>
                <DialogTitle className="font-sora text-[28px] font-bold leading-[36px] text-cm-text">
                  {a.title}
                </DialogTitle>
                <p className="font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                  {a.fullDescription}
                </p>

                <div className="mt-5 rounded-[16px] border border-[rgba(133,154,206,0.16)] bg-cm-panel p-5">
                  <p className={metaLabel}>{a.priceLabel}</p>
                  <p className="mt-0.5 font-sora text-[24px] font-extrabold leading-[30px] text-cm-neon">
                    {a.price ?? (a.mode === "project" ? "Collaboration" : "Price to define")}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Row label="Type" value={a.sponsorshipType} />
                    {a.videoType && <Row label="Video" value={a.videoType} />}
                    {showDuration(a) && a.duration && <Row label="Duration" value={a.duration} />}
                    <Row label="Payment" value={a.paymentMode} />
                    <Row label="Deadline" value={a.deadline} />
                    <Row label="Availability" value={a.availability} />
                  </div>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <p className={metaLabel}>{a.mode === "project" ? "Attentes du projet" : "Brief attendu"}</p>
                    <SimpleList items={a.requirements} />
                  </div>
                  <div>
                    <p className={metaLabel}>Livrables</p>
                    <SimpleList items={a.deliverables} />
                  </div>
                </div>

                {a.mode === "creator" && (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Row label="Audience du createur" value={a.targetAudience} />
                    <Row label="Lien associe" value={a.linked} />
                  </div>
                )}

                <p className="font-manrope text-[13px] font-medium leading-[20px] text-cm-text2">
                  {a.contactInstructions}
                </p>

                <div className="flex flex-wrap items-center gap-3 border-t border-[rgba(133,154,206,0.18)] pt-5">
                  <button type="button" className={btnPrimary} onClick={() => onContact(a)}>
                    {a.mode === "project" ? "Apply" : "Contact"}
                  </button>
                  <button type="button" className={btnSecondary}>Save</button>
                </div>
              </SectionCard>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
