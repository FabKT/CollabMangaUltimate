import { useEffect, useMemo, useState } from "react";
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
import { loadStudioProjects } from "@/lib/studio-projects";
import { listProfiles } from "@/lib/db";
import { listSponsorOptions } from "@/lib/sponsorship-options";

type StudioProjectOption = { id: string; title: string };

type CreatorOption = {
  id: string;
  name: string;
  initials: string;
  meta: string;
  bio: string;
  services: Service[];
};

export function SponsorshipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [projectId, setProjectId] = useState("");
  const [myProjects, setMyProjects] = useState<StudioProjectOption[]>([]);
  const [query, setQuery] = useState("");
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [creatorId, setCreatorId] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<Service[]>([]);
  const [currency] = useState("EUR");
  const [messageTitle, setMessageTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all([loadStudioProjects<StudioProjectOption>(), listProfiles(200), listSponsorOptions()])
      .then(([projects, profiles, options]) => {
        setMyProjects(projects);
        setProjectId((current) => current || projects[0]?.id || "");
        const creators = profiles
          .filter((profile) => {
            const role = (profile.role ?? "").toLocaleLowerCase();
            return role.includes("contenu") || role.includes("content");
          })
          .map((profile) => {
            const name = profile.display_name || profile.username;
            const creatorServices = options
              .filter((option) => option.mode === "creator" && option.ownerId === profile.id)
              .map((option): Service => ({
                id: option.id,
                name: option.format,
                format: option.videoType || option.format,
                duration: option.duration,
                platforms: option.platforms.filter((platform): platform is Platform =>
                  ["TikTok", "YouTube", "Instagram", "Twitter/X", "Other"].includes(platform),
                ),
                quantity: option.quantity,
                price: Math.max(0, Number(option.price) || 0),
                paymentType: option.paymentMode.toLocaleLowerCase().includes("abonnement")
                  ? ("subscription" as PaymentType)
                  : ("one_time" as PaymentType),
                notes: option.description,
              }));
            return {
              id: profile.id,
              name,
              initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
              meta: profile.role || "Créateur de contenu",
              bio: "Profil CollabManga",
              services: creatorServices,
            };
          })
          .filter((creator) => creator.services.length > 0);
        setCreatorOptions(creators);
        setCreatorId((current) =>
          creators.some((creator) => creator.id === current) ? current : creators[0]?.id ?? "",
        );
      })
      .catch(() => {
        setMyProjects([]);
        setCreatorOptions([]);
      });
  }, [open]);

  const creators = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return creatorOptions;
    return creatorOptions.filter((creator) =>
      `${creator.name} ${creator.meta} ${creator.bio}`.toLowerCase().includes(term),
    );
  }, [creatorOptions, query]);

  const selectedCreator = creatorOptions.find((creator) => creator.id === creatorId) ?? creatorOptions[0];
  const selectedProject = myProjects.find((item) => item.id === projectId) ?? null;
  const availableServices = [...(selectedCreator?.services ?? []), ...customServices];
  const selectedServices = availableServices.filter((service) => selectedServiceIds.includes(service.id));
  const total = selectedServices.reduce((sum, item) => sum + item.price, 0);

  const reset = () => {
    setProjectId("");
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

  const submit = async () => {
    setError("");
    if (!selectedProject) {
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

    try {
      const sponsorship = await createSponsorship({
        name: `${selectedProject.title} - ${selectedCreator.name}`,
        project: selectedProject.title,
        projectId: selectedProject.id,
        creatorId: selectedCreator.id,
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
        ],
      });

      await sendSponsorshipContact({
        sponsorshipId: sponsorship.id,
        announcementTitle: messageTitle.trim() || `Demande de parrainage - ${selectedProject.title}`,
        announcementMode: "creator",
        owner: selectedCreator.id,
        linked: selectedProject.title,
        budgetOrPrice: formatMoney(total, currency),
        sponsorshipType: selectedServices.map(serviceLabel).join(", "),
        message: message.trim(),
      });
      close();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Le parrainage n'a pas pu être créé.");
    }
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
              {myProjects.length > 0 ? (
                <select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {myProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              ) : (
                <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
                  Crée d'abord un projet avant d'ajouter un parrainage.
                </p>
              )}
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
