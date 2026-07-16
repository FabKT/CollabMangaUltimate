/**
 * Langues du site (celles proposées dans le profil).
 * - `label` : nom complet, affiché dans les dropdowns (filtres, formulaires).
 * - `code`  : abréviation, affichée sur les fiches profil et les cartes.
 */

export type SiteLanguage = { code: string; label: string };

export const SITE_LANGUAGES: SiteLanguage[] = [
  { code: "FR", label: "Français" },
  { code: "ENG", label: "English" },
  { code: "ES", label: "Español" },
  { code: "IT", label: "Italiano" },
  { code: "JP", label: "日本語" },
  { code: "DE", label: "Deutsch" },
  { code: "PT", label: "Português" },
  { code: "KR", label: "한국어" },
  { code: "CN", label: "中文" },
  { code: "NL", label: "Nederlands" },
  { code: "AR", label: "العربية" },
  { code: "HI", label: "हिन्दी" },
];

export function languageLabel(code: string): string {
  return SITE_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function languageCode(label: string): string {
  return SITE_LANGUAGES.find((l) => l.label === label)?.code ?? label;
}
