import { useMemo, useState } from "react";
import { Modal, Field, inputCls } from "./ui";
import {
  createSponsorship,
  formatMoney,
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
      service("pp-2", "Launch-week short bundle", "Presentation", "30-60 s", ["TikTok", "Instagram"], 3, 260, "per_content"),
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
      service("mt-2", "Stream mention", "Sponsored mention", "0-30 s", ["Other"], 4, 180, "per_quantity"),
    ],
  },
  {
    id: "u10",
    name: "Manga Relay",
    initials: "MR",
    meta: "31k followers - TikTok, Twitter/X",
    bio: "Formats courts, hooks de lancement et posts communautaires pour nouveaux chapitres.",
    services: [
      service("mr-1", "Short dedicated video", "Presentation", "0-30 s", ["TikTok"], 2, 180, "per_content"),
      service("mr-2", "Community post pack", "Sponsored mention", "0-30 s", ["Twitter/X", "Instagram"], 3, 140, "per_quantity"),
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
  const [project, setProject] = useState("Neon Ronin");
  const [query, setQuery] = useState("");
  const [creatorId, setCreatorId] = useState(creatorOptions[0]?.id ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<Service[]>([]);
  const [deadline, setDeadline] = useState("");
  const [currency, setCurrency] = useState("EUR");
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
    setProject("Neon Ronin");
    setQuery("");
    setCreatorId(creatorOptions[0]?.id ?? "");
    setSelectedServiceIds([]);
    setCustomServices([]);
    setDeadline("");
    setCurrency("EUR");
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
    if (!message.trim()) {
      setError("Écris le message à envoyer au créateur de contenu.");
      return;
    }

    createSponsorship({
      name: `${project.trim()} - ${selectedCreator.name}`,
      project: project.trim(),
      creator: selectedCreator.name,
      totalPrice: total,
      currency,
      status: "pending",
      paymentType: selectedServices[0]?.paymentType ?? "one_time",
      deadline: deadline || undefined,
      notes: message.trim(),
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
      announcementTitle: `Demande de parrainage - ${project.trim()}`,
      announcementMode: "creator",
      owner: selectedCreator.name,
      linked: project.trim(),
      budgetOrPrice: formatMoney(total, currency),
      sponsorshipType: selectedServices.map((item) => item.name).join(", "),
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
        size="lg"
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
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <h3 className="font-display text-base font-semibold text-foreground">1. Projet à promouvoir</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Le parrainage sera créé en attente, puis activé seulement si le créateur de contenu accepte.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Projet manga" required>
                <input className={inputCls} value={project} onChange={(e) => setProject(e.target.value)} placeholder="Neon Ronin" />
              </Field>
              <Field label="Date souhaitée">
                <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <h3 className="font-display text-base font-semibold text-foreground">2. Rechercher un créateur de contenu</h3>
            <Field label="Recherche">
              <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, plateforme, audience..." />
            </Field>
            <div className="mt-3 grid gap-2">
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
                      <span className="mt-1 block text-sm text-text-secondary">{creator.bio}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">3. Options de parrainage</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Sélectionne les options configurées par le créateur, ou crée une option personnalisée.
                </p>
              </div>
              <button className="btn-ghost rounded-lg border border-border px-3 py-2 text-sm font-semibold" onClick={() => setServiceModalOpen(true)}>
                Créer une autre option
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {availableServices.map((item) => {
                const active = selectedServiceIds.includes(item.id);
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
                        <span className="mt-1 block text-xs text-text-muted">
                          {item.format} - {item.duration} - {item.platforms.join(", ")}
                        </span>
                      </span>
                      <span className="font-display text-sm font-bold text-neon">{formatMoney(item.price, currency)}</span>
                    </span>
                    <span className="text-xs text-text-secondary">
                      Quantité : {item.quantity} - Paiement : {item.paymentType.replace("_", " ")}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface-3 px-3 py-2">
              <span className="text-sm font-semibold text-text-secondary">Total proposé</span>
              <span className="font-display text-lg font-bold text-neon">{formatMoney(total, currency)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface/60 p-4">
            <h3 className="font-display text-base font-semibold text-foreground">4. Message à envoyer</h3>
            <textarea
              className={`${inputCls} mt-3 min-h-[120px]`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Présente ton projet, la période souhaitée, les objectifs de promotion et les éléments disponibles."
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-3 py-2 text-sm font-semibold text-[#FF5F7E]">
              {error}
            </div>
          )}
        </div>
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
