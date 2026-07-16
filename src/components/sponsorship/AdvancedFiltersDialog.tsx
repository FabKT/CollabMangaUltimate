import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { btnPrimary, btnSecondary, inputCls } from "./ui";
import type { AnnouncementMode } from "@/lib/sponsorship-data";
import { SITE_LANGUAGES, languageLabel } from "@/lib/languages";

/* Filter state shared with the sponsorship page. */
export type SponsorFilters = {
  sponsorTypes: string[];
  videoTypes: string[];
  durations: string[];
  genres: string[];
  subGenres: string[];
  platforms: string[];
  paymentModes: string[];
  languages: string[];
  minPrice: string;
  maxPrice: string;
  minChapters: string;
  maxChapters: string;
  minSubs: string;
  maxSubs: string;
};

export const emptyFilters: SponsorFilters = {
  sponsorTypes: [],
  videoTypes: [],
  durations: [],
  genres: [],
  subGenres: [],
  platforms: [],
  paymentModes: [],
  languages: [],
  minPrice: "",
  maxPrice: "",
  minChapters: "",
  maxChapters: "",
  minSubs: "",
  maxSubs: "",
};

export const SPONSOR_TYPES = ["Post communautaire", "Vidéo longue dédiée", "Vidéo courte dédiée", "Placement dans une vidéo", "Story"];
const VIDEO_TYPES = ["Analyse profonde", "Review", "Reaction", "Présentation"];
const DURATIONS = ["0–30 s", "30–60 s", "60–120 s", "2–3 min", "3–5 min", "5–10 min", "10+ min"];
const GENRES = ["Shonen", "Seinen", "Shojo", "Josei"];
const SUBGENRES = ["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"];
const PLATFORMS = ["Youtube", "Tiktok", "Instagram", "Twitter"];
const PAYMENT_MODES = ["Abonnement", "Paiement unique"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-manrope text-[13px] font-bold text-cm-text">{children}</div>;
}

// One filter row: title + all options shown at once as selectable chips (no dropdown).
function ChipRow({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={cn(
                "rounded-full px-3 py-1.5 font-manrope text-[13px] font-medium transition-colors",
                active
                  ? "border border-transparent bg-cm-neon text-[#04111e]"
                  : "border border-[rgba(133,154,206,0.18)] bg-cm-input text-cm-text2 hover:border-[rgba(133,154,206,0.40)]",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-manrope text-[13px] font-bold text-cm-text">{label}</span>
      <input className={inputCls} inputMode="numeric" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="font-sora text-[18px] font-bold leading-[26px] text-cm-text">{title}</h3>
      {children}
    </section>
  );
}

export function AdvancedFiltersDialog({
  open,
  onOpenChange,
  mode,
  filters,
  setFilters,
  onReset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: AnnouncementMode;
  filters: SponsorFilters;
  setFilters: React.Dispatch<React.SetStateAction<SponsorFilters>>;
  onReset: () => void;
}) {
  const toggle = (key: keyof SponsorFilters, val: string) =>
    setFilters((f) => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  const setNum = (key: keyof SponsorFilters, val: string) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-none gap-0 border-[rgba(133,154,206,0.28)] bg-cm-panel p-0 w-[95vw] max-w-[820px] max-h-[85vh] rounded-[24px] overflow-hidden text-cm-text">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6 md:p-8">
            <DialogTitle className="font-sora text-[28px] font-bold leading-[36px] text-cm-text">Filtres avancés</DialogTitle>
            <DialogDescription className="mt-1 font-manrope text-[14px] font-medium text-cm-text2">
              {mode === "project"
                ? "Affinez votre recherche de créateurs de contenu à parrainer."
                : "Affinez votre recherche de projets à parrainer."}
            </DialogDescription>

            <div className="mt-6 space-y-8">
              <Section title="Parrainage">
                <ChipRow label="Type de vidéo" options={VIDEO_TYPES} selected={filters.videoTypes} onToggle={(v) => toggle("videoTypes", v)} />
                <ChipRow label="Durée de vidéo" options={DURATIONS} selected={filters.durations} onToggle={(v) => toggle("durations", v)} />
                <div>
                  <FieldLabel>Langue</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value=""
                      onChange={(e) => {
                        const code = e.target.value;
                        if (code && !filters.languages.includes(code)) toggle("languages", code);
                      }}
                      aria-label="Ajouter une langue au filtre"
                      className={cn(inputCls, "h-10 w-auto min-w-[220px]")}
                    >
                      <option value="">Ajouter une langue…</option>
                      {SITE_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                    {filters.languages.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggle("languages", code)}
                        className="rounded-full border border-transparent bg-cm-neon px-3 py-1.5 font-manrope text-[13px] font-medium text-[#04111e]"
                      >
                        {languageLabel(code)} ✕
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {mode === "project" ? (
                <Section title="Projet">
                  <ChipRow label="Genre" options={GENRES} selected={filters.genres} onToggle={(v) => toggle("genres", v)} />
                  <ChipRow label="Sous-genre" options={SUBGENRES} selected={filters.subGenres} onToggle={(v) => toggle("subGenres", v)} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Nombre de chapitres minimum" value={filters.minChapters} onChange={(v) => setNum("minChapters", v)} />
                    <NumberField label="Nombre de chapitres maximal" value={filters.maxChapters} onChange={(v) => setNum("maxChapters", v)} />
                  </div>
                </Section>
              ) : (
                <Section title="Créateur de contenu">
                  <ChipRow label="Plateforme" options={PLATFORMS} selected={filters.platforms} onToggle={(v) => toggle("platforms", v)} />
                  <ChipRow label="Mode de paiement" options={PAYMENT_MODES} selected={filters.paymentModes} onToggle={(v) => toggle("paymentModes", v)} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField label="Nombre d'abonnés minimum" value={filters.minSubs} onChange={(v) => setNum("minSubs", v)} />
                    <NumberField label="Nombre d'abonnés maximal" value={filters.maxSubs} onChange={(v) => setNum("maxSubs", v)} />
                  </div>
                </Section>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(133,154,206,0.18)] pt-6">
              <button type="button" className={btnSecondary} onClick={onReset}>
                Réinitialiser
              </button>
              <button type="button" className={btnPrimary} onClick={() => onOpenChange(false)}>
                Appliquer
              </button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
