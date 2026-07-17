/**
 * Petit bus d'événement pour signaler qu'un crédit vient d'être consommé
 * (après une génération d'image), afin que l'affichage du quota (sidebar,
 * page plan) se rafraîchisse sans polling permanent.
 */

const EVENT = "collabmanga:credits-changed";

export function notifyCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onCreditsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
