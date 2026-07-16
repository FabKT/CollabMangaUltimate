import { useMemo, useState } from "react";
import { Modal, Field, inputCls } from "./ui";
import {
  createSponsorship,
  formatMoney,
  PAYMENT_LABEL,
  type PaymentType,
  type Platform,
  type Service,
} from "./store";
import { ServiceModal } from "./ServiceModal";
import { sendSponsorshipContact } from "@/lib/user-workflows";

type CreatorOption = {
  id: string;
  name: string;
  initials: string;
  meta: string;
  bio: string;
  services: Service[];
};

const creatorOptions: CreatorOption[] = [
  {
    id: "u3",
    name: "PanelPulse",
    initials: "PP",
    meta: "48k followers - YouTube, TikTok, Instagram",
    bio: "Reviews hebdomadaires et mise en avant de projets manga indépendants.",
    services: [
      service("pp-1", "Dedicated review video", "Review", "10+ min", ["YouTube"], 1, 420, "one_time"),
      service("pp-2", "Launch-week short bundle", "Presentation", "30-60 s", ["TikTok", "Instagram"], 3, 260, "one_time"),
    ],
  },
  {
    id: "u9",
    name: "Midori Talks",
    initials: "MT",
    meta: "12k followers - YouTube, Twitch",
    bio: "Essais vidéo sur le shojo classique, le josei moderne et les sorties indé.",
    services: [
      service("mt-1", "Long-form analysis", "Deep analysis", "10+ min", ["YouTube"], 1, 350, "one_time"),
      service("mt-2", "Stream mention", "Sponsored mention", "0-30 s", ["Other"], 4, 180, "one_time"),
    ],
  },
  {
    id: "u10",
    name: "Manga Relay",
    initials: "MR",
    meta: "31k followers - TikTok, Twitter/X",
    bio: "Formats courts, hooks de lancement et posts communautaires pour nouveaux chapitres.",
    services: [
      service("mr-1", "Short dedicated video", "Presentation", "0-30 s", ["TikTok"], 2, 180, "one_time"),
      service("mr-2", "Community post pack", "Sponsored mention", "0-30 s", ["Twitter/X", "Instagram"], 3, 140, "one_time"),
    ],
  },
];

function service(
  id: string,
  name: string,
  format: string,
  duration: string,
  platforms: Platform[],
  quantity: number,
  price: number,
  paymentType: PaymentType,
): Service {
  return { id, name, format, duration, platforms, quantity, price, paymentType };
}

export function SponsorshipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [project, setProject] = useState("");
  const [query, setQuery] = useState("");
  const [creatorId, setCreatorId] = useState(creatorOptions[0]?.id ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<Service[]>([]);
  const [currency] = useState("EUR");
  const [messageTitle, setMessageTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  const creators = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return creatorOptions;
    return creatorOptions.filter((creator) =>
      `${creator.name} ${creator.meta} ${creator.bio}`.toLowerCase().includes(term),
    );
  }, [query]);

  const selectedCreator = creatorOptions.find((creator) => creator.id === creatorId) ?? creatorOptions[0];
  const availableServices = [...(selectedCreator?.services ?? []), ...customServices];
  const selectedServices = availableServices.filter((service) => selectedServiceIds.includes(service.id));
  const total = selectedServices.reduce((sum, item) => sum + item.price, 0);

  const reset = () => {
    setProject("");
    setQuery("");
    setCreatorId(creatorOptions[0]?.id ?? "");
    setSelectedServiceIds([]);
    setCustomServices([]);
    setMessageTitle("");
    setMessage("");
    setError("");
    setServiceModalOpen(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = () => {
    setError("");
    if (!project.trim()) {
      setError("Sélectionne ou renseigne le projet concerné.");
      return;
    }
    if (!selectedCreator) {
      setError("Sélectionne un créateur de contenu.");
      return;
    }
    if (selectedServices.length === 0) {
      setError("Sélectionne au moins une option de parrainage.");
      return;
    }
    if (!messageTitle.trim()) {
      setError("Donne un titre à ton message.");
      return;
    }
    if (!message.trim()) {
      setError("Écris le message à envoyer au créateur de contenu.");
      return;
    }

    // Les options créées à la volée sont marquées « option supplémentaire ».
    const customIds = new Set(customServices.map((s) => s.id));
    const serviceLabel = (s: Service) => (customIds.has(s.id) ? `${s.name} (option supplémentaire)` : s.name);

    createSponsorship({
      name: `${project.trim()} - ${selectedCreator.name}`,
      project: project.trim(),
      creator: selectedCreator.name,
      totalPrice: total,
      currency,
      status: "pending",
      paymentType: selectedServices[0]?.paymentType ?? "one_time",
      notes: messageTitle.trim() ? `${messageTitle.trim()} — ${message.trim()}` : message.trim(),
      conditions: "En attente de validation par le créateur de contenu.",
      services: selectedServices,
      participants: [
        {
          id: selectedCreator.id,
          name: selectedCreator.name,
          role: "creator",
          meta: selectedCreator.meta,
          initials: selectedCreator.initials,
        },
        {
          id: "project-owner",
          name: "Current project owner",
          role: "owner",
          meta: project.trim(),
          initials: "PO",
        },
      ],
    });

    sendSponsorshipContact({
      announcementTitle: messageTitle.trim() || `Demande de parrainage - ${project.trim()}`,
      announcementMode: "creator",
      owner: selectedCreator.name,
      linked: project.trim(),
      budgetOrPrice: formatMoney(total, currency),
      sponsorshipType: selectedServices.map(serviceLabel).join(", "),
      message: message.trim(),
    });

    close();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title="Ajouter un parrainage"
        size="xl"
        footer={
          <>
            <button className="btn-ghost rounded-lg px-4 py-2 text-sm font-medium" onClick={close}>
              Annuler
            </button>
            <button className="btn-neon rounded-lg px-4 py-2 text-sm font-semibold" onClick={submit}>
              Envoyer la demande
            </button>
          </>
        }
      >
        {/* 3 colonnes égales séparées par des lignes verticales. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1px_1fr_1px_1fr]">
          {/* Colonne 1 — projet + créateur */}
          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">1. Projet & créateur</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Le parrainage sera créé en attente, puis activé si le créateur accepte.
              </p>
            </div>
            <Field label="Projet manga à parrainer" required>
              <input className={inputCls} value={project} onChange={(e) => setProject(e.target.value)} placeholder="Nom du projet" />
            </Field>
            <Field label="Rechercher un créateur de contenu">
              <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, plateforme, audience..." />
            </Field>
            <div className="grid max-h-[380px] gap-2 overflow-y-auto pr-1">
              {creators.map((creator) => {
                const active = creator.id === creatorId;
                return (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => {
                      setCreatorId(creator.id);
                      setSelectedServiceIds([]);
                      setCustomServices([]);
                    }}
                    className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-left transition ${
                      active ? "border-neon/60 bg-neon-soft" : "border-border bg-surface-3 hover:border-neon/35"
                    }`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface font-display text-sm font-bold text-neon">
                      {creator.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{creator.name}</span>
                      <span className="mt-0.5 block text-xs text-text-muted">{creator.meta}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden bg-border lg:block" aria-hidden />

          {/* Colonne 2 — options du créateur + ajout */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-foreground">2. Services du créateur</h3>
              <button className="btn-ghost rounded-lg border border-border px-3 py-1.5 text-sm font-semibold" onClick={() => setServiceModalOpen(true)}>
                Add service
              </button>
            </div>
            <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
              {availableServices.length === 0 && (
                <p className="text-sm text-text-secondary">Ce créateur n'a pas encore de service configuré — ajoute une option supplémentaire.</p>
              )}
              {availableServices.map((item) => {
                const active = selectedServiceIds.includes(item.id);
                const isCustom = customServices.some((s) => s.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleService(item.id)}
                    className={`grid gap-2 rounded-xl border p-3 text-left transition ${
                      active ? "border-neon/60 bg-neon-soft" : "border-border bg-surface-3 hover:border-neon/35"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-semibold text-foreground">{item.name}</span>
                        {isCustom && (
                          <span className="mt-0.5 inline-block rounded-full border border-neon/45 bg-neon-soft px-2 py-0.5 text-[11px] font-bold text-neon">
                            Option supplémentaire
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-text-muted">
                          {item.format} - {item.duration} - {item.platforms.join(", ")}
                        </span>
                      </span>
                      <span className="font-display text-sm font-bold text-neon">{formatMoney(item.price, currency)}</span>
                    </span>
                    <span className="text-xs text-text-secondary">
                      Quantité : {item.quantity} - Paiement : {PAYMENT_LABEL[item.paymentType]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-3 px-3 py-2">
              <span className="text-sm font-semibold text-text-secondary">Total proposé</span>
              <span className="font-display text-lg font-bold text-neon">{formatMoney(total, currency)}</span>
            </div>
          </div>

          <div className="hidden bg-border lg:block" aria-hidden />

          {/* Colonne 3 — message */}
          <div className="min-w-0 space-y-4">
            <h3 className="font-display text-base font-semibold text-foreground">3. Message à envoyer</h3>
            <Field label="Titre" required>
              <input
                className={inputCls}
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                placeholder="Objet de la demande"
              />
            </Field>
            <Field label="Description" required>
              <textarea
                className={`${inputCls} min-h-[240px]`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Présente ton projet, la période souhaitée, les objectifs de promotion et les éléments disponibles."
              />
            </Field>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-3 py-2 text-sm font-semibold text-[#FF5F7E]">
            {error}
          </div>
        )}
      </Modal>

      <ServiceModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        onSaveDraft={(service) => {
          setCustomServices((current) => [...current, service]);
          setSelectedServiceIds((current) => [...current, service.id]);
        }}
      />
    </>
  );
}
