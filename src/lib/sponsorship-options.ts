/**
 * Options de parrainage créées par les utilisateurs (localStorage).
 *
 * Deux origines :
 *  - mode "creator" : option créée depuis un profil créateur de contenu →
 *    visible dans « Trouver un créateur de contenu » ;
 *  - mode "project" : annonce créée depuis un projet (Studio) →
 *    visible dans « Trouver un projet ».
 */

export type SponsorOptionMode = "creator" | "project";

export type SponsorOption = {
  id: string;
  mode: SponsorOptionMode;
  /** Format de parrainage : « Vidéo longue dédiée », « Story »… (titre de l'option) */
  format: string;
  platforms: string[];
  videoType: string;
  duration: string;
  paymentMode: string;
  price: string;
  quantity: number;
  description: string;
  ownerName: string;
  chaptersMin?: number;
  chaptersMax?: number;
  createdAt: string;
};

const STORAGE_KEY = "collabmanga.sponsorOptions.v1";

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function listSponsorOptions(): SponsorOption[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SponsorOption[]) : [];
  } catch {
    return [];
  }
}

function save(options: SponsorOption[]) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    /* quota — tant pis, session seulement */
  }
}

export function addSponsorOption(
  input: Omit<SponsorOption, "id" | "createdAt">,
): SponsorOption {
  const option: SponsorOption = {
    ...input,
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  save([option, ...listSponsorOptions()]);
  return option;
}

export function updateSponsorOption(id: string, patch: Partial<SponsorOption>) {
  save(listSponsorOptions().map((o) => (o.id === id ? { ...o, ...patch } : o)));
}

export function removeSponsorOption(id: string) {
  save(listSponsorOptions().filter((o) => o.id !== id));
}
