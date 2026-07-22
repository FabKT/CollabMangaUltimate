import { newServiceId, upsertService, type PaymentType, type Platform, type Service } from "./store";
import { ServiceFormModal } from "@/components/sponsorship/ServiceFormModal";

/**
 * Ajout / modification d'un service sur la page « parrainage sélectionné ».
 * Utilise le popup service unifié du site, avec en plus le champ lien de
 * livraison (spécificité de cette page).
 */

const PLATFORM_ALIAS: Record<string, Platform> = {
  Youtube: "YouTube",
  Tiktok: "TikTok",
  Instagram: "Instagram",
  Twitter: "Twitter/X",
};

const PLATFORM_BACK: Record<string, string> = {
  YouTube: "Youtube",
  TikTok: "Tiktok",
  Instagram: "Instagram",
  "Twitter/X": "Twitter",
};

export function ServiceModal({
  open,
  onClose,
  sponsorshipId,
  initial,
  onSaveDraft,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  sponsorshipId?: string;
  initial?: Service;
  onSaveDraft?: (service: Service) => void;
  onError?: (message: string) => void;
}) {
  const isEdit = !!initial;

  return (
    <ServiceFormModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier le service" : "Add service"}
      submitLabel={isEdit ? "Enregistrer" : "Add service"}
      showLink
      showChapters={false}
      initial={
        initial
          ? {
              format: initial.format || initial.name,
              platforms: initial.platforms.map((p) => PLATFORM_BACK[p] ?? p),
              duration: initial.duration,
              paymentMode: initial.paymentType === "subscription" ? "Abonnement" : "Paiement unique",
              price: String(initial.price),
              quantity: initial.quantity,
              description: initial.notes ?? "",
              link: initial.deliveryLink,
            }
          : undefined
      }
      onSubmit={async (values) => {
        const svc: Service = {
          id: initial?.id ?? newServiceId(),
          name: values.format,
          format: values.format,
          duration: values.duration,
          platforms: values.platforms.map((p) => PLATFORM_ALIAS[p] ?? ("Other" as Platform)),
          quantity: values.quantity,
          price: Math.max(0, Number(values.price) || 0),
          paymentType: (values.paymentMode === "Abonnement" ? "subscription" : "one_time") as PaymentType,
          deliveryLink: values.link,
          notes: values.description || undefined,
        };
        if (onSaveDraft) {
          onSaveDraft(svc);
        } else if (sponsorshipId) {
          try {
            await upsertService(sponsorshipId, svc);
          } catch (error) {
            onError?.(error instanceof Error ? error.message : "Le service n'a pas pu être enregistré.");
            return;
          }
        }
        onClose();
      }}
    />
  );
}
