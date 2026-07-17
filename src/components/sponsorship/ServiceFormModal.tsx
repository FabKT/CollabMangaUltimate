import { useEffect, useState, type ReactNode } from "react";
import { SITE_LANGUAGES } from "@/lib/languages";

/**
 * Popup unique d'ajout / modification d'un service de parrainage.
 * C'est LE formulaire de référence (repris de la page profil) utilisé partout :
 * profil, studio (projet), hub parrainage. La page « parrainage sélectionné »
 * l'utilise avec `showLink` pour ajouter le lien de livraison.
 */

export type ServiceFormValues = {
  format: string;
  platforms: string[];
  videoType: string;
  duration: string;
  paymentMode: string;
  price: string;
  quantity: number;
  description: string;
  language: string;
  chaptersMin?: number;
  chaptersMax?: number;
  subscribersMin?: number;
  subscribersMax?: number;
  link?: string;
};

const FORMATS = ["Post communautaire", "Vidéo longue dédiée", "Vidéo courte dédiée", "Placement dans une vidéo", "Story"];
const PLATFORMS = ["Youtube", "Tiktok", "Instagram", "Twitter"];
const VIDEO_TYPES = ["Analyse profonde", "Review", "Reaction", "Présentation"];
const DURATIONS = ["0–30 s", "30–60 s", "60–120 s", "2–3 min", "3–5 min", "5–10 min", "10+ min"];
const PAYMENTS = ["Abonnement", "Paiement unique"];

const inputStyle: React.CSSProperties = {
  background: "#0E193A",
  border: "1px solid rgba(133,154,206,0.20)",
  borderRadius: 14,
  height: 44,
  padding: "0 14px",
  color: "#F7FAFF",
  width: "100%",
  fontSize: 14,
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: "#7F8CB3" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  multi = false,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  multi?: boolean;
  onChange: (next: string[]) => void;
}) {
  const toggle = (o: string) => {
    if (multi) onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
    else onChange(selected[0] === o ? [] : [o]);
  };
  return (
    <div>
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: "#7F8CB3" }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors"
              style={
                active
                  ? { borderColor: "rgba(57,255,136,0.45)", background: "rgba(57,255,136,0.12)", color: "#39FF88" }
                  : { borderColor: "rgba(133,154,206,0.18)", background: "#0E193A", color: "#B8C4E5" }
              }
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ServiceFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
  showLink = false,
  showChapters = true,
  mode = "creator",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ServiceFormValues) => void;
  initial?: Partial<ServiceFormValues>;
  title?: string;
  submitLabel?: string;
  showLink?: boolean;
  showChapters?: boolean;
  /** "creator" (défaut) : le service précise les chapitres du projet visés. "project" : l'annonce est postée par un projet, elle précise l'audience recherchée chez le créateur. */
  mode?: "creator" | "project";
}) {
  const [format, setFormat] = useState<string[]>(initial?.format ? [initial.format] : []);
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? []);
  const [videoType, setVideoType] = useState<string[]>(initial?.videoType ? [initial.videoType] : []);
  const [duration, setDuration] = useState<string[]>(initial?.duration ? [initial.duration] : []);
  const [payment, setPayment] = useState<string[]>(initial?.paymentMode ? [initial.paymentMode] : []);
  const [price, setPrice] = useState(initial?.price ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ? String(initial.quantity) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "FR");
  const [chaptersMin, setChaptersMin] = useState(initial?.chaptersMin ? String(initial.chaptersMin) : "");
  const [chaptersMax, setChaptersMax] = useState(initial?.chaptersMax ? String(initial.chaptersMax) : "");
  const [subscribersMin, setSubscribersMin] = useState(initial?.subscribersMin ? String(initial.subscribersMin) : "");
  const [subscribersMax, setSubscribersMax] = useState(initial?.subscribersMax ? String(initial.subscribersMax) : "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [error, setError] = useState<string | null>(null);

  // Resynchronise tous les champs sur `initial` à chaque ouverture : sans ça,
  // les valeurs d'un service qu'on édite ne s'affichent pas (state figé au 1er montage).
  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }
    setFormat(initial?.format ? [initial.format] : []);
    setPlatforms(initial?.platforms ?? []);
    setVideoType(initial?.videoType ? [initial.videoType] : []);
    setDuration(initial?.duration ? [initial.duration] : []);
    setPayment(initial?.paymentMode ? [initial.paymentMode] : []);
    setPrice(initial?.price ?? "");
    setQuantity(initial?.quantity ? String(initial.quantity) : "");
    setDescription(initial?.description ?? "");
    setLanguage(initial?.language ?? "FR");
    setChaptersMin(initial?.chaptersMin ? String(initial.chaptersMin) : "");
    setChaptersMax(initial?.chaptersMax ? String(initial.chaptersMax) : "");
    setSubscribersMin(initial?.subscribersMin ? String(initial.subscribersMin) : "");
    setSubscribersMax(initial?.subscribersMax ? String(initial.subscribersMax) : "");
    setLink(initial?.link ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!format[0]) {
      setError("Choisis un format de parrainage (un seul par service).");
      return;
    }
    onSubmit({
      format: format[0],
      platforms,
      videoType: videoType[0] ?? "—",
      duration: duration[0] ?? "—",
      paymentMode: payment[0] ?? "Paiement unique",
      price: price.trim() || "0",
      quantity: Math.max(1, Number(quantity) || 1),
      description: description.trim(),
      language,
      chaptersMin: mode === "creator" ? Number(chaptersMin) || undefined : undefined,
      chaptersMax: mode === "creator" ? Number(chaptersMax) || undefined : undefined,
      subscribersMin: mode === "project" ? Number(subscribersMin) || undefined : undefined,
      subscribersMax: mode === "project" ? Number(subscribersMax) || undefined : undefined,
      link: link.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[24px]"
        style={{ background: "#0B1430", border: "1px solid rgba(133,154,206,0.28)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(133,154,206,0.14)" }}>
          <h3 className="text-[18px] font-bold" style={{ color: "#F7FAFF", fontFamily: "var(--font-sora, inherit)" }}>
            {title ?? "Add service"}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg px-2 py-1 text-[18px]" style={{ color: "#7F8CB3" }}>
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <ChipRow multi label="Plateforme" options={PLATFORMS} selected={platforms} onChange={setPlatforms} />
          <ChipRow label="Format de parrainage (un seul par service)" options={FORMATS} selected={format} onChange={setFormat} />
          <ChipRow label="Type de vidéo" options={VIDEO_TYPES} selected={videoType} onChange={setVideoType} />
          <ChipRow label="Durée de vidéo" options={DURATIONS} selected={duration} onChange={setDuration} />
          <ChipRow label="Mode de paiement" options={PAYMENTS} selected={payment} onChange={setPayment} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Quantité">
              <input type="number" min={0} style={inputStyle} placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <Field label="Prix (€)">
              <input type="number" min={0} style={inputStyle} placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Langue">
              <select style={inputStyle} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {SITE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              style={{ ...inputStyle, height: 96, padding: "12px 14px", resize: "vertical" }}
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {showLink && (
            <Field label="Lien de livraison (optionnel)">
              <input style={inputStyle} placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            </Field>
          )}
          {showChapters && mode === "creator" && (
            <div className="rounded-[16px] p-4" style={{ background: "#08112B", border: "1px solid rgba(133,154,206,0.18)" }}>
              <div className="mb-3 text-[15px] font-bold" style={{ color: "#F7FAFF" }}>Chapitres du projet</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Nombre de chapitres minimum">
                  <input type="number" min={0} style={inputStyle} placeholder="0" value={chaptersMin} onChange={(e) => setChaptersMin(e.target.value)} />
                </Field>
                <Field label="Nombre de chapitres maximal">
                  <input type="number" min={0} style={inputStyle} placeholder="0" value={chaptersMax} onChange={(e) => setChaptersMax(e.target.value)} />
                </Field>
              </div>
            </div>
          )}
          {showChapters && mode === "project" && (
            <div className="rounded-[16px] p-4" style={{ background: "#08112B", border: "1px solid rgba(133,154,206,0.18)" }}>
              <div className="mb-3 text-[15px] font-bold" style={{ color: "#F7FAFF" }}>Audience du créateur recherché</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Abonnés minimum">
                  <input type="number" min={0} style={inputStyle} placeholder="0" value={subscribersMin} onChange={(e) => setSubscribersMin(e.target.value)} />
                </Field>
                <Field label="Abonnés maximum">
                  <input type="number" min={0} style={inputStyle} placeholder="0" value={subscribersMax} onChange={(e) => setSubscribersMax(e.target.value)} />
                </Field>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,95,126,0.10)", border: "1px solid rgba(255,95,126,0.35)", color: "#FF5F7E" }}>
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "rgba(133,154,206,0.14)", background: "#0A1028" }}>
          <button onClick={onClose} className="rounded-[14px] px-4 py-2.5 text-[14px] font-bold" style={{ color: "#B8C4E5" }}>
            Annuler
          </button>
          <button
            onClick={submit}
            className="rounded-[14px] px-5 py-2.5 text-[14px] font-bold"
            style={{ background: "#39FF88", color: "#04111E" }}
          >
            {submitLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
