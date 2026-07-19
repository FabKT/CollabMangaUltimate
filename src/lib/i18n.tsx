import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";

export type AppLocale = "fr" | "en";

const STORAGE_KEY = "collabmanga.locale";

const messages = {
  fr: {
    "common.language": "Langue",
    "common.french": "Français",
    "common.english": "English",
    "common.continue": "Continuer",
    "common.save": "Enregistrer",
    "common.loading": "Chargement...",
    "auth.login": "Connexion",
    "auth.loginSubtitle": "Content de te revoir ! Connecte-toi pour retrouver tes projets.",
    "auth.signup": "Inscription",
    "auth.signupSubtitle": "Crée ton compte pour lancer tes projets manga et collaborer.",
    "auth.email": "Adresse e-mail",
    "auth.password": "Mot de passe",
    "auth.confirmPassword": "Confirmer le mot de passe",
    "auth.create": "Créer mon compte",
    "auth.creating": "Création du compte...",
    "auth.loggingIn": "Connexion...",
    "auth.noAccount": "Pas encore de compte ?",
    "auth.hasAccount": "Déjà un compte ?",
    "auth.google": "Continuer avec Google",
    "auth.or": "ou",
    "auth.signOut": "Se déconnecter",
    "onboarding.title": "Configurer votre profil",
    "onboarding.subtitle":
      "Ces informations permettent de personnaliser CollabManga et de vous connecter aux bons collaborateurs.",
    "onboarding.username": "Nom d'utilisateur",
    "onboarding.primaryRole": "Rôle principal",
    "onboarding.secondaryRole": "Rôle secondaire",
    "onboarding.noSecondaryRole": "Aucun rôle secondaire",
    "onboarding.avatar": "Photo de profil",
    "onboarding.siteLanguage": "Langue du site",
    "onboarding.finish": "Terminer la configuration",
    "role.artist": "Dessinateur",
    "role.writer": "Scénariste",
    "role.contentCreator": "Créateur de contenu",
    "role.reader": "Lecteur",
    "nav.community": "Communauté",
    "nav.home": "Accueil",
    "nav.discover": "Découvrir",
    "nav.announcements": "Annonces",
    "nav.sponsoring": "Parrainage",
    "nav.sponsorshipHub": "Mes parrainages",
    "nav.illustrations": "Illustrations",
    "nav.creation": "Création",
    "nav.projects": "Mes projets",
    "nav.ideas": "Idées",
    "nav.reading": "Lecture",
    "nav.catalog": "Catalogue",
    "nav.communication": "Communication",
    "nav.messages": "Messages",
    "nav.notifications": "Notifications",
    "nav.account": "Compte",
    "nav.profile": "Profil",
    "nav.aiStudio": "Studio de création IA",
    "nav.characterCreate": "Création de personnage",
    "nav.styleTransfer": "Transfert de style",
    "nav.freeStudio": "Studio libre",
    "nav.imageEdit": "Modification d'image",
    "nav.library": "Bibliothèque",
    "nav.characterLibrary": "Bibliothèque de personnages",
    "nav.history": "Historique",
    "nav.plan": "Plan & Images",
    "intro.home": "Accueil",
    "intro.about": "À propos",
    "intro.catalog": "Catalogue",
    "intro.collabDescription":
      "Créez, organisez, publiez et développez des projets manga avec d'autres créateurs.",
    "intro.collabCta": "Entrer dans CollabManga",
    "intro.aiDescription":
      "Utilisez des outils IA pour accélérer la création de planches, de personnages et de chapitres.",
    "intro.aiCta": "Ouvrir CollabManga AI",
    "intro.goal": "Notre objectif",
    "intro.goalTitle": "Aider les projets manga à grandir plus vite et mieux",
    "intro.goalText":
      "CollabManga donne aux créateurs les outils nécessaires pour collaborer, organiser la production, publier des chapitres et gagner en visibilité, avec des workflows assistés par IA lorsque cela est utile. La plateforme soutient la création de mangas originaux sur les marchés occidentaux en réunissant scénaristes, dessinateurs, créateurs de contenu et lecteurs.",
    "intro.collaborate": "Collaborer",
    "intro.collaborateText":
      "Trouvez des scénaristes et des dessinateurs, formez une équipe et gérez les rôles de chaque projet.",
    "intro.organize": "Organiser la production",
    "intro.organizeText":
      "Planifiez les chapitres et les pages, centralisez les notes et le calendrier, puis suivez ce qui est prêt à publier.",
    "intro.publish": "Publier et grandir",
    "intro.publishText":
      "Publiez vos chapitres dans le catalogue, rassemblez des lecteurs et développez l'audience de votre série.",
    "intro.whyTitle": "Pourquoi CollabManga existe",
    "intro.whyText":
      "CollabManga réunit toutes les personnes impliquées dans la création de mangas hors du Japon, où trouver les bons collaborateurs reste difficile. Un seul écosystème, conçu spécifiquement pour le manga original.",
    "intro.writersText":
      "Construisez des univers et des scénarios, recrutez des dessinateurs et dirigez vos projets.",
    "intro.artistsText":
      "Dessinez des planches, couvertures et illustrations, rejoignez des équipes, présentez votre portfolio et trouvez des collaborations.",
    "intro.contentCreatorsText":
      "Faites connaître des mangas grâce aux parrainages et touchez de nouveaux lecteurs.",
    "intro.readersText":
      "Découvrez des séries, suivez leurs chapitres et soutenez leurs créateurs.",
    "intro.aiTitle": "Des outils IA conçus pour la production manga",
    "intro.aiText":
      "Générez des planches, maintenez la cohérence des personnages entre les chapitres et accélérez la production grâce à une assistance IA sensible au style.",
    "intro.discoverAi": "Découvrir CollabManga AI",
    "intro.pageCreatorText":
      "Composez des planches complètes à partir de prompts, de références et d'instructions de mise en page.",
    "intro.consistency": "Cohérence des personnages",
    "intro.consistencyText":
      "Réutilisez les cartes de personnages pour conserver les visages et les tenues entre les chapitres.",
    "intro.styleTransferText":
      "Appliquez un style visuel cohérent à vos illustrations en quelques clics.",
    "intro.rawFinalText": "Transformez des croquis bruts en cases manga finalisées et stylisées.",
    "intro.finalTitle": "Commencez à construire votre projet manga",
    "intro.signup": "S'inscrire",
    "intro.exploreCatalog": "Explorer le catalogue",
    "intro.rights": "Tous droits réservés.",
  },
  en: {
    "common.language": "Language",
    "common.french": "Français",
    "common.english": "English",
    "common.continue": "Continue",
    "common.save": "Save",
    "common.loading": "Loading...",
    "auth.login": "Log in",
    "auth.loginSubtitle": "Welcome back. Log in to access your projects.",
    "auth.signup": "Sign up",
    "auth.signupSubtitle": "Create your account to start manga projects and collaborate.",
    "auth.email": "Email address",
    "auth.password": "Password",
    "auth.confirmPassword": "Confirm password",
    "auth.create": "Create my account",
    "auth.creating": "Creating account...",
    "auth.loggingIn": "Logging in...",
    "auth.noAccount": "No account yet?",
    "auth.hasAccount": "Already have an account?",
    "auth.google": "Continue with Google",
    "auth.or": "or",
    "auth.signOut": "Log out",
    "onboarding.title": "Set up your profile",
    "onboarding.subtitle":
      "This information personalizes CollabManga and helps you connect with the right collaborators.",
    "onboarding.username": "Username",
    "onboarding.primaryRole": "Primary role",
    "onboarding.secondaryRole": "Secondary role",
    "onboarding.noSecondaryRole": "No secondary role",
    "onboarding.avatar": "Profile picture",
    "onboarding.siteLanguage": "Site language",
    "onboarding.finish": "Finish setup",
    "role.artist": "Artist",
    "role.writer": "Writer",
    "role.contentCreator": "Content creator",
    "role.reader": "Reader",
    "nav.community": "Community",
    "nav.home": "Home",
    "nav.discover": "Discover",
    "nav.announcements": "Announcements",
    "nav.sponsoring": "Sponsoring",
    "nav.sponsorshipHub": "My sponsorships",
    "nav.illustrations": "Illustrations",
    "nav.creation": "Creation",
    "nav.projects": "My projects",
    "nav.ideas": "Ideas",
    "nav.reading": "Reading",
    "nav.catalog": "Catalog",
    "nav.communication": "Communication",
    "nav.messages": "Messages",
    "nav.notifications": "Notifications",
    "nav.account": "Account",
    "nav.profile": "Profile",
    "nav.aiStudio": "AI creation studio",
    "nav.characterCreate": "Character creation",
    "nav.styleTransfer": "Style transfer",
    "nav.freeStudio": "Free studio",
    "nav.imageEdit": "Image editing",
    "nav.library": "Library",
    "nav.characterLibrary": "Character library",
    "nav.history": "History",
    "nav.plan": "Plan & Images",
    "intro.home": "Home",
    "intro.about": "About",
    "intro.catalog": "Catalog",
    "intro.collabDescription":
      "Create, organize, publish, and grow manga projects with other creators.",
    "intro.collabCta": "Enter CollabManga",
    "intro.aiDescription":
      "Use AI tools to accelerate manga page creation, characters, and chapters.",
    "intro.aiCta": "Open CollabManga AI",
    "intro.goal": "Our goal",
    "intro.goalTitle": "Helping manga projects grow faster, and better",
    "intro.goalText":
      "CollabManga gives creators the tools to collaborate, organize production, publish chapters, and gain visibility, with AI-assisted workflows whenever they are needed. The platform supports original manga creation in Western markets by connecting writers, artists, content creators, and readers.",
    "intro.collaborate": "Collaborate",
    "intro.collaborateText":
      "Find writers and artists, form a team, and manage roles on every project.",
    "intro.organize": "Organize production",
    "intro.organizeText":
      "Plan chapters and pages, keep notes and a calendar, and track what is ready to publish.",
    "intro.publish": "Publish and grow",
    "intro.publishText":
      "Release chapters to the catalog, gather readers, and build an audience for your series.",
    "intro.whyTitle": "Why CollabManga exists",
    "intro.whyText":
      "CollabManga connects everyone involved in manga creation outside Japan, where finding the right collaborators is still hard. One ecosystem, built specifically for original manga.",
    "intro.writersText": "Build worlds and scenarios, recruit artists, and lead projects.",
    "intro.artistsText":
      "Draw pages, covers, and illustrations, join teams, showcase a portfolio, and find collaborations.",
    "intro.contentCreatorsText": "Promote manga through sponsorships and reach new readers.",
    "intro.readersText": "Discover series, follow chapters, and support creators.",
    "intro.aiTitle": "AI tools built for manga production",
    "intro.aiText":
      "Generate manga pages, keep characters consistent across chapters, and speed up production with style-aware AI assistance.",
    "intro.discoverAi": "Discover CollabManga AI",
    "intro.pageCreatorText":
      "Compose full manga pages from prompts, references, and panel instructions.",
    "intro.consistency": "Character consistency",
    "intro.consistencyText":
      "Reuse character cards to keep faces and outfits consistent across chapters.",
    "intro.styleTransferText":
      "Apply a coherent visual style to your artwork in a couple of clicks.",
    "intro.rawFinalText": "Turn rough sketches into finished, styled manga panels.",
    "intro.finalTitle": "Start building your manga project",
    "intro.signup": "Sign up",
    "intro.exploreCatalog": "Explore catalog",
    "intro.rights": "All rights reserved.",
  },
} as const;

export type TranslationKey = keyof (typeof messages)["fr"];

type I18nValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return "fr";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "fr" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("fr");

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    if (supabase) {
      void supabase.auth.updateUser({ data: { site_locale: next } });
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          void supabase
            .from("profiles")
            .update({ site_locale: next })
            .eq("id", data.session.user.id);
        }
      });
    }
  }, []);

  useEffect(() => {
    setLocaleState(initialLocale());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      const preferred = data.session?.user.user_metadata?.site_locale;
      if (preferred === "fr" || preferred === "en") setLocaleState(preferred);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key) => messages[locale][key] }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <select
      aria-label={t("common.language")}
      value={locale}
      onChange={(event) => setLocale(event.target.value as AppLocale)}
      className={className}
    >
      <option value="fr">FR</option>
      <option value="en">EN</option>
    </select>
  );
}
