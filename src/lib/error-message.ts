/**
 * Extrait un message lisible d'une erreur de type inconnu.
 *
 * Beaucoup d'erreurs Supabase (PostgrestError, StorageError…) sont des objets
 * simples `{ message, code, details, hint }` et ne sont PAS des instances de
 * `Error`. Un `String(reason)` naïf produit alors « [object Object] » et masque
 * la vraie cause. Ce helper gère string, Error, et objets porteurs de message.
 */
export function errorMessage(
  reason: unknown,
  fallback = "Une erreur inattendue est survenue.",
): string {
  if (typeof reason === "string") return reason;
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === "object") {
    const maybe = reason as {
      message?: unknown;
      error_description?: unknown;
      details?: unknown;
    };
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
    if (typeof maybe.error_description === "string" && maybe.error_description.trim())
      return maybe.error_description;
    if (typeof maybe.details === "string" && maybe.details.trim()) return maybe.details;
  }
  return fallback;
}
