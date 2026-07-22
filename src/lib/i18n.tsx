import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "./supabase";

export type AppLocale = "fr" | "en";

const STORAGE_KEY = "collabmanga.locale";

const messages = {
  fr: {
    "common.language": "Langue",
    "common.french": "Français",
    "common.english": "Anglais",
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
    "nav.mangaPage": "Manga Page Creator",
    "nav.rawFinal": "Raw vers Final",
    "nav.swap": "Swap",
    "nav.admin": "Admin — Générations",
    "nav.workspace": "Espace de travail",
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
    "catalog.eyebrow": "Découvrir",
    "catalog.title": "Catalogue",
    "catalog.description": "Explorez les mangas originaux publiés par les créateurs CollabManga.",
    "catalog.search": "Rechercher un manga...",
    "catalog.sortDesc": "Avis décroissants",
    "catalog.sortAsc": "Avis croissants",
    "catalog.language": "Langue",
    "catalog.addLanguage": "Ajouter une langue...",
    "catalog.ratings": "Notes",
    "catalog.genre": "Genre",
    "catalog.chapters": "Chapitres",
    "catalog.minimum": "Minimum",
    "catalog.maximum": "Maximum",
    "catalog.subgenre": "Sous-genre",
    "catalog.clear": "Réinitialiser les filtres",
    "catalog.results": "résultats",
    "catalog.noResults": "Aucun manga ne correspond à ces filtres.",
    "catalog.active": "Actifs",
    "catalog.noResultsTitle": "Aucun manga trouvé",
    "catalog.by": "par",
    "catalog.view": "Voir le manga",
    "catalog.discover": "Découvrir",
    "hub.welcomeBadge": "Bienvenue sur CollabManga",
    "hub.welcomeTitle": "Créez et publiez des manga, ensemble",
    "hub.welcomeText":
      "Le catalogue se remplit à mesure que les créateurs publient leurs séries. Lance ton projet dans le Studio ou explore les outils IA pour produire tes premières planches.",
    "hub.openStudio": "Ouvrir le Studio",
    "hub.topManga": "Top Manga",
    "hub.readNow": "Lire maintenant",
    "hub.details": "Détails",
    "hub.readChapter": "Lire le chapitre",
    "hub.emptyTitle": "Le catalogue est encore vide",
    "hub.emptyText":
      "Les mangas publiés par les créateurs apparaîtront ici : favoris des lecteurs, nouveaux chapitres et pépites à découvrir. Sois parmi les premiers à publier.",
    "hub.launchProject": "Lancer un projet",
    "hub.findCollaborators": "Trouver des collaborateurs",
    "hub.readerPicks": "Coups de cœur des lecteurs",
    "hub.favoriteManga": "Mangas favoris",
    "hub.favoriteSubtitle": "Les histoires que les lecteurs relisent sans cesse sur CollabManga.",
    "hub.seeAll": "Voir tout",
    "hub.latestDrops": "Dernières sorties",
    "hub.newReleases": "Nouveaux chapitres",
    "hub.newReleasesSubtitle":
      "Tout frais du studio — les chapitres les plus récents publiés par les créateurs.",
    "hub.underrated": "Sous-estimés",
    "hub.hiddenGems": "Pépites cachées",
    "hub.hiddenGemsSubtitle": "Des mangas méconnus qui méritent une place dans votre bibliothèque.",
    "hub.exploreBadge": "Explorer CollabManga",
    "hub.discoverMore": "Découvrez plus de manga originaux",
    "hub.discoverMoreText":
      "Explorez le catalogue et découvrez de nouvelles histoires créées par les créateurs CollabManga.",
    "hub.startProject": "Démarrer un projet manga",
    "sponsorHub.badge": "CollabManga · Parrainages",
    "sponsorHub.title": "Mes parrainages",
    "sponsorHub.description":
      "Gérez vos collaborations de parrainage : prix, services, plateformes, liens de livraison et statuts.",
    "sponsorHub.add": "Ajouter un parrainage",
    "sponsorHub.search": "Rechercher par parrainage, projet, créateur ou statut…",
    "sponsorHub.project": "Projet",
    "sponsorHub.creator": "Créateur",
    "sponsorHub.total": "Total",
    "sponsorHub.view": "Voir le parrainage",
    "sponsorHub.services": "services",
    "sponsorHub.due": "échéance",
    "sponsorHub.empty": "Aucun parrainage pour l'instant",
    "sponsorHub.emptyText":
      "Créez un parrainage pour gérer une collaboration avec un créateur de contenu ou un projet manga.",
    "sponsorStatus.all": "Tous",
    "sponsorStatus.activated": "Activés",
    "sponsorStatus.pending": "En attente",
    "sponsorStatus.finished": "Terminés",
    "sponsorStatus.cancelled": "Annulés",
    "payment.oneTime": "Paiement unique",
    "payment.subscription": "Abonnement",
    "sponsorRole.creator": "Créateur",
    "sponsorRole.project": "Projet",
    "sponsorRole.manager": "Manager",
    "sponsorRole.collaborator": "Collaborateur",
    "sponsorDetail.notFound": "Parrainage introuvable",
    "sponsorDetail.notFoundText": "Il a peut-être été supprimé ou le lien est incorrect.",
    "sponsorDetail.back": "Retour aux parrainages",
    "sponsorDetail.moreActions": "Plus d'actions",
    "sponsorDetail.changeStatus": "Changer le statut",
    "sponsorDetail.finish": "Terminer le parrainage",
    "sponsorDetail.cancel": "Annuler le parrainage",
    "sponsorDetail.leave": "Quitter le parrainage",
    "sponsorDetail.delete": "Supprimer le parrainage",
    "sponsorDetail.confirmDelete": "Supprimer ce parrainage ? Cette action est irréversible.",
    "sponsorDetail.confirmLeave": "Quitter ce parrainage ? Tu seras retiré de cette collaboration.",
    "sponsorDetail.confirmRemoveService": "Retirer ce service ?",
    "sponsorDetail.totalPrice": "Prix total",
    "sponsorDetail.monthlyPayment": "Paiement mensuel",
    "sponsorDetail.payment": "Paiement",
    "sponsorDetail.deadline": "Échéance",
    "sponsorDetail.services": "Services",
    "sponsorDetail.linksAdded": "liens de livraison ajoutés",
    "sponsorDetail.addService": "Ajouter un service",
    "sponsorDetail.noServices": "Aucun service pour l'instant.",
    "sponsorDetail.addFirstService": "Ajouter un premier service",
    "sponsorDetail.colService": "Service",
    "sponsorDetail.colPlatforms": "Plateformes",
    "sponsorDetail.colQty": "Qté",
    "sponsorDetail.colPrice": "Prix",
    "sponsorDetail.colDelivery": "Livraison",
    "sponsorDetail.colActions": "Actions",
    "sponsorDetail.edit": "Modifier",
    "sponsorDetail.remove": "Retirer",
    "sponsorDetail.deliveryConditions": "Conditions de livraison",
    "sponsorDetail.deliveryConditionsSub": "Exigences, livrables, échéances et notes.",
    "sponsorDetail.paymentType": "Type de paiement",
    "sponsorDetail.currency": "Devise",
    "sponsorDetail.created": "Créé le",
    "sponsorDetail.conditions": "Conditions",
    "sponsorDetail.noConditions":
      "Aucune condition fournie. Ajoutez les livrables, échéances, règles de publication ou conditions d'annulation.",
    "sponsorDetail.internalNotes": "Notes internes",
    "sponsorDetail.participants": "Participants & entités liées",
    "sponsorDetail.participantsSub": "Personnes et entités liées à ce parrainage.",
    "sponsorDetail.noParticipants": "Aucun participant lié.",
    "sponsorDetail.viewProject": "Voir le projet",
    "sponsorDetail.viewProfile": "Voir le profil",
    "sponsorDetail.noLink": "Aucun lien",
    "sponsorDetail.openLink": "Ouvrir le lien",
    "sponsor.title": "Parrainage",
    "sponsor.subtitle":
      "Trouvez des créateurs de contenu, des offres de parrainage et des projets manga à mettre en avant.",
    "sponsor.findProject": "Trouver un projet",
    "sponsor.findCreator": "Trouver un créateur de contenu",
    "sponsor.searchCreator": "Rechercher un créateur de contenu",
    "sponsor.searchProject": "Rechercher un projet",
    "sponsor.priceMin": "Prix min",
    "sponsor.priceMax": "Prix max",
    "sponsor.priceMinAria": "Prix minimum",
    "sponsor.priceMaxAria": "Prix maximal",
    "sponsor.advancedFilters": "Filtres avancés",
    "sponsor.sponsorType": "Type de parrainage",
    "sponsor.activeFilters": "Filtres actifs",
    "sponsor.noActiveFilters": "Aucun filtre actif.",
    "sponsor.removeFilter": "Retirer le filtre",
    "sponsor.resetAll": "Tout réinitialiser",
    "sponsor.searchChip": "Recherche :",
    "sponsor.chipMinChapters": "Chapitres min",
    "sponsor.chipMaxChapters": "Chapitres max",
    "sponsor.chipMinSubs": "Abonnés min",
    "sponsor.chipMaxSubs": "Abonnés max",
    "sponsor.noResults": "Aucune annonce de parrainage trouvée",
    "sponsor.noResultsText": "Essayez d'ajuster vos filtres.",
    "sponsor.resetFilters": "Réinitialiser les filtres",
    "sponsor.replyProject": "Répondre à ce projet",
    "sponsor.contactCreator": "Contacter ce créateur",
    "sponsor.creatorProfile": "Profil créateur / chaîne",
    "sponsor.mangaToPromote": "Projet manga à promouvoir",
    "sponsor.creatorPlaceholder": "Ex : ma chaîne YouTube manga",
    "sponsor.projectPlaceholder": "Ex : Neon Ronin",
    "sponsor.proposedRate": "Tarif proposé",
    "sponsor.budgetSlot": "Budget ou créneau souhaité",
    "sponsor.ratePlaceholder": "Ex : 250 €",
    "sponsor.budgetPlaceholder": "Ex : budget à définir",
    "sponsor.message": "Message",
    "sponsor.messageProjectPlaceholder":
      "Présente ton audience, ton format de contenu et ce que tu proposes pour ce projet.",
    "sponsor.messageCreatorPlaceholder":
      "Présente ton manga, ton objectif de promotion et la période souhaitée.",
    "sponsor.cancel": "Annuler",
    "sponsor.send": "Envoyer",
    "sponsor.errorProfile": "Indique ton profil ou ta chaîne.",
    "sponsor.errorProject": "Indique le projet à promouvoir.",
    "sponsor.errorMessage": "Ajoute un court message pour contextualiser la demande.",
    "sponsor.sentProject": "Candidature envoyée au projet. Le workflow de parrainage est créé.",
    "sponsor.sentCreator":
      "Message envoyé au créateur de contenu. Le workflow de parrainage est créé.",
    "sponsor.linkedProjectDefault": "Ma chaîne / mon profil créateur",
    "sponsor.linkedCreatorDefault": "Mon projet manga",
    "sponsor.budgetTBD": "À définir",
    "mangaDetail.loading": "Chargement…",
    "mangaDetail.backToCatalog": "Retour au catalogue",
    "mangaDetail.coverPending": "Couverture à venir",
    "mangaDetail.genreSubgenres": "Genre & sous-genres",
    "mangaDetail.tabChapters": "Chapitres",
    "mangaDetail.tabRecruitment": "Recrutement",
    "mangaDetail.tabSponsorship": "Parrainage",
    "mangaDetail.tabCollaborators": "Collaborateurs",
    "mangaDetail.publishedChapters": "Chapitres publiés",
    "mangaDetail.noChapters": "Aucun chapitre publié pour l'instant.",
    "mangaDetail.readablePage": "page lisible",
    "mangaDetail.readablePages": "pages lisibles",
    "mangaDetail.recruitmentAnnouncements": "Annonces de recrutement",
    "mangaDetail.noRecruitment": "Aucune annonce de recrutement publiée.",
    "mangaDetail.sponsorshipAnnouncements": "Annonces de parrainage",
    "mangaDetail.noSponsorship": "Aucune annonce de parrainage publiée.",
    "mangaDetail.collaborators": "Collaborateurs",
    "mangaDetail.noCollaborators": "Aucun collaborateur pour l'instant.",
    "mangaDetail.you": "Vous",
    "mangaDetail.creator": "Créateur",
    "mangaDetail.notFound": "Manga introuvable",
    "mangaDetail.notFoundText": "Ce manga n'existe pas ou n'est plus disponible.",
    "chapter.loading": "Chargement…",
    "chapter.prevPage": "Page précédente",
    "chapter.nextPage": "Page suivante",
    "chapter.pages": "Pages",
    "chapter.page": "Page",
    "chapter.noPages": "Aucune page validée avec image dans ce chapitre pour l'instant.",
    "chapter.comments": "Commentaires",
    "chapter.readingMode": "Mode de lecture",
    "chapter.scroll": "Scroll",
    "chapter.pagination": "Pagination",
    "chapter.chapter": "Chapitre",
    "chapter.prevChapter": "Chapitre précédent",
    "chapter.nextChapter": "Chapitre suivant",
    "chapter.lastChapter": "Dernier chapitre",
    "chapter.rateTitle": "Donnez-nous votre note du chapitre",
    "chapter.yourRating": "Ta note :",
    "chapter.rateAria": "Noter",
    "chapter.notFound": "Chapitre introuvable",
    "chapter.notFoundText": "Ce chapitre n'existe pas ou n'est plus disponible.",
  },
  en: {
    "common.language": "Language",
    "common.french": "French",
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
    "nav.mangaPage": "Manga Page Creator",
    "nav.rawFinal": "Raw to Final",
    "nav.swap": "Swap",
    "nav.admin": "Admin — Generations",
    "nav.workspace": "Workspace",
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
    "catalog.eyebrow": "Browse",
    "catalog.title": "Catalog",
    "catalog.description": "Explore original manga published by CollabManga creators.",
    "catalog.search": "Search manga...",
    "catalog.sortDesc": "Ratings descending",
    "catalog.sortAsc": "Ratings ascending",
    "catalog.language": "Language",
    "catalog.addLanguage": "Add a language...",
    "catalog.ratings": "Ratings",
    "catalog.genre": "Genre",
    "catalog.chapters": "Chapters",
    "catalog.minimum": "Minimum",
    "catalog.maximum": "Maximum",
    "catalog.subgenre": "Subgenre",
    "catalog.clear": "Reset filters",
    "catalog.results": "results",
    "catalog.noResults": "No manga matches these filters.",
    "catalog.active": "Active",
    "catalog.noResultsTitle": "No manga found",
    "catalog.by": "by",
    "catalog.view": "View manga",
    "catalog.discover": "Discover",
    "hub.welcomeBadge": "Welcome to CollabManga",
    "hub.welcomeTitle": "Create and publish manga, together",
    "hub.welcomeText":
      "The catalog fills up as creators publish their series. Launch your project in the Studio or explore the AI tools to produce your first pages.",
    "hub.openStudio": "Open the Studio",
    "hub.topManga": "Top Manga",
    "hub.readNow": "Read now",
    "hub.details": "Details",
    "hub.readChapter": "Read chapter",
    "hub.emptyTitle": "The catalog is still empty",
    "hub.emptyText":
      "Manga published by creators will appear here: reader favorites, new chapters, and hidden gems to discover. Be among the first to publish.",
    "hub.launchProject": "Launch a project",
    "hub.findCollaborators": "Find collaborators",
    "hub.readerPicks": "Reader picks",
    "hub.favoriteManga": "Favorite Manga",
    "hub.favoriteSubtitle": "The stories readers keep coming back to on CollabManga.",
    "hub.seeAll": "See all",
    "hub.latestDrops": "Latest drops",
    "hub.newReleases": "New Chapter Releases",
    "hub.newReleasesSubtitle":
      "Fresh from the studio — the most recent chapters posted by creators.",
    "hub.underrated": "Underrated",
    "hub.hiddenGems": "Hidden Gems",
    "hub.hiddenGemsSubtitle": "Lesser-known manga that deserve a spot on your shelf.",
    "hub.exploreBadge": "Explore CollabManga",
    "hub.discoverMore": "Discover more original manga",
    "hub.discoverMoreText":
      "Explore the catalog and find new stories created by CollabManga creators.",
    "hub.startProject": "Start a Manga Project",
    "sponsorHub.badge": "CollabManga · Sponsorships",
    "sponsorHub.title": "My Sponsorships",
    "sponsorHub.description":
      "Manage sponsorship collaborations, prices, services, platforms, delivery links, and statuses.",
    "sponsorHub.add": "Add a sponsorship",
    "sponsorHub.search": "Search by sponsorship, project, creator, or status…",
    "sponsorHub.project": "Project",
    "sponsorHub.creator": "Creator",
    "sponsorHub.total": "Total",
    "sponsorHub.view": "View sponsorship",
    "sponsorHub.services": "services",
    "sponsorHub.due": "due",
    "sponsorHub.empty": "No sponsorships yet",
    "sponsorHub.emptyText":
      "Create a sponsorship to manage a collaboration with a content creator or manga project.",
    "sponsorStatus.all": "All",
    "sponsorStatus.activated": "Activated",
    "sponsorStatus.pending": "Pending",
    "sponsorStatus.finished": "Finished",
    "sponsorStatus.cancelled": "Cancelled",
    "payment.oneTime": "One-time payment",
    "payment.subscription": "Subscription",
    "sponsorRole.creator": "Creator",
    "sponsorRole.project": "Project",
    "sponsorRole.manager": "Manager",
    "sponsorRole.collaborator": "Collaborator",
    "sponsorDetail.notFound": "Sponsorship not found",
    "sponsorDetail.notFoundText": "It may have been deleted or the link is incorrect.",
    "sponsorDetail.back": "Back to sponsorships",
    "sponsorDetail.moreActions": "More actions",
    "sponsorDetail.changeStatus": "Change status",
    "sponsorDetail.finish": "Finish sponsorship",
    "sponsorDetail.cancel": "Cancel sponsorship",
    "sponsorDetail.leave": "Leave sponsorship",
    "sponsorDetail.delete": "Delete sponsorship",
    "sponsorDetail.confirmDelete": "Delete this sponsorship? This cannot be undone.",
    "sponsorDetail.confirmLeave": "Leave this sponsorship? You will be removed from this collaboration.",
    "sponsorDetail.confirmRemoveService": "Remove this service?",
    "sponsorDetail.totalPrice": "Total price",
    "sponsorDetail.monthlyPayment": "Monthly payment",
    "sponsorDetail.payment": "Payment",
    "sponsorDetail.deadline": "Deadline",
    "sponsorDetail.services": "Services",
    "sponsorDetail.linksAdded": "delivery links added",
    "sponsorDetail.addService": "Add service",
    "sponsorDetail.noServices": "No services yet.",
    "sponsorDetail.addFirstService": "Add first service",
    "sponsorDetail.colService": "Service",
    "sponsorDetail.colPlatforms": "Platforms",
    "sponsorDetail.colQty": "Qty",
    "sponsorDetail.colPrice": "Price",
    "sponsorDetail.colDelivery": "Delivery",
    "sponsorDetail.colActions": "Actions",
    "sponsorDetail.edit": "Edit",
    "sponsorDetail.remove": "Remove",
    "sponsorDetail.deliveryConditions": "Delivery conditions",
    "sponsorDetail.deliveryConditionsSub": "Requirements, deliverables, deadlines, and notes.",
    "sponsorDetail.paymentType": "Payment type",
    "sponsorDetail.currency": "Currency",
    "sponsorDetail.created": "Created",
    "sponsorDetail.conditions": "Conditions",
    "sponsorDetail.noConditions":
      "No conditions provided. Add deliverables, deadlines, publication rules, or cancellation terms.",
    "sponsorDetail.internalNotes": "Internal notes",
    "sponsorDetail.participants": "Participants & linked entities",
    "sponsorDetail.participantsSub": "People and entities linked to this sponsorship.",
    "sponsorDetail.noParticipants": "No participants linked.",
    "sponsorDetail.viewProject": "View project",
    "sponsorDetail.viewProfile": "View profile",
    "sponsorDetail.noLink": "No link yet",
    "sponsorDetail.openLink": "Open link",
    "sponsor.title": "Sponsorship",
    "sponsor.subtitle":
      "Find content creators, sponsorship offers, and manga projects to promote.",
    "sponsor.findProject": "Find a project",
    "sponsor.findCreator": "Find a content creator",
    "sponsor.searchCreator": "Search for a content creator",
    "sponsor.searchProject": "Search for a project",
    "sponsor.priceMin": "Min price",
    "sponsor.priceMax": "Max price",
    "sponsor.priceMinAria": "Minimum price",
    "sponsor.priceMaxAria": "Maximum price",
    "sponsor.advancedFilters": "Advanced filters",
    "sponsor.sponsorType": "Sponsorship type",
    "sponsor.activeFilters": "Active filters",
    "sponsor.noActiveFilters": "No active filter.",
    "sponsor.removeFilter": "Remove filter",
    "sponsor.resetAll": "Reset all",
    "sponsor.searchChip": "Search:",
    "sponsor.chipMinChapters": "Min chapters",
    "sponsor.chipMaxChapters": "Max chapters",
    "sponsor.chipMinSubs": "Min subscribers",
    "sponsor.chipMaxSubs": "Max subscribers",
    "sponsor.noResults": "No sponsorship announcement found",
    "sponsor.noResultsText": "Try adjusting your filters.",
    "sponsor.resetFilters": "Reset filters",
    "sponsor.replyProject": "Reply to this project",
    "sponsor.contactCreator": "Contact this creator",
    "sponsor.creatorProfile": "Creator profile / channel",
    "sponsor.mangaToPromote": "Manga project to promote",
    "sponsor.creatorPlaceholder": "e.g. my manga YouTube channel",
    "sponsor.projectPlaceholder": "e.g. Neon Ronin",
    "sponsor.proposedRate": "Proposed rate",
    "sponsor.budgetSlot": "Budget or desired slot",
    "sponsor.ratePlaceholder": "e.g. €250",
    "sponsor.budgetPlaceholder": "e.g. budget to be defined",
    "sponsor.message": "Message",
    "sponsor.messageProjectPlaceholder":
      "Introduce your audience, your content format, and what you offer for this project.",
    "sponsor.messageCreatorPlaceholder":
      "Introduce your manga, your promotion goal, and the desired period.",
    "sponsor.cancel": "Cancel",
    "sponsor.send": "Send",
    "sponsor.errorProfile": "Specify your profile or channel.",
    "sponsor.errorProject": "Specify the project to promote.",
    "sponsor.errorMessage": "Add a short message to give context to your request.",
    "sponsor.sentProject": "Application sent to the project. The sponsorship workflow is created.",
    "sponsor.sentCreator":
      "Message sent to the content creator. The sponsorship workflow is created.",
    "sponsor.linkedProjectDefault": "My channel / creator profile",
    "sponsor.linkedCreatorDefault": "My manga project",
    "sponsor.budgetTBD": "To be defined",
    "mangaDetail.loading": "Loading…",
    "mangaDetail.backToCatalog": "Back to catalog",
    "mangaDetail.coverPending": "Cover pending",
    "mangaDetail.genreSubgenres": "Genre & subgenres",
    "mangaDetail.tabChapters": "Chapters",
    "mangaDetail.tabRecruitment": "Recruitment",
    "mangaDetail.tabSponsorship": "Sponsorship",
    "mangaDetail.tabCollaborators": "Collaborators",
    "mangaDetail.publishedChapters": "Published chapters",
    "mangaDetail.noChapters": "No published chapter yet.",
    "mangaDetail.readablePage": "readable page",
    "mangaDetail.readablePages": "readable pages",
    "mangaDetail.recruitmentAnnouncements": "Recruitment announcements",
    "mangaDetail.noRecruitment": "No recruitment announcement published.",
    "mangaDetail.sponsorshipAnnouncements": "Sponsorship announcements",
    "mangaDetail.noSponsorship": "No sponsorship announcement published.",
    "mangaDetail.collaborators": "Collaborators",
    "mangaDetail.noCollaborators": "No collaborator yet.",
    "mangaDetail.you": "You",
    "mangaDetail.creator": "Creator",
    "mangaDetail.notFound": "Manga not found",
    "mangaDetail.notFoundText": "This manga doesn't exist or is no longer available.",
    "chapter.loading": "Loading…",
    "chapter.prevPage": "Previous page",
    "chapter.nextPage": "Next page",
    "chapter.pages": "Pages",
    "chapter.page": "Page",
    "chapter.noPages": "No validated page with an image in this chapter yet.",
    "chapter.comments": "Comments",
    "chapter.readingMode": "Reading mode",
    "chapter.scroll": "Scroll",
    "chapter.pagination": "Pagination",
    "chapter.chapter": "Chapter",
    "chapter.prevChapter": "Previous chapter",
    "chapter.nextChapter": "Next chapter",
    "chapter.lastChapter": "Last chapter",
    "chapter.rateTitle": "Give us your rating for this chapter",
    "chapter.yourRating": "Your rating:",
    "chapter.rateAria": "Rate",
    "chapter.notFound": "Chapter not found",
    "chapter.notFoundText": "This chapter doesn't exist or is no longer available.",
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
    const client = supabase;
    if (client) {
      void client.auth.updateUser({ data: { site_locale: next } });
      void client.auth.getSession().then(({ data }) => {
        if (data.session) {
          void client.from("profiles").update({ site_locale: next }).eq("id", data.session.user.id);
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const options: { value: AppLocale; label: string; flag: string }[] = [
    { value: "fr", label: t("common.french"), flag: "/flags/fr.png" },
    { value: "en", label: t("common.english"), flag: "/flags/en.png" },
  ];
  const selected = options.find((option) => option.value === locale) ?? options[0];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={t("common.language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-full w-full items-center justify-center gap-2 rounded-[inherit] px-3"
        style={{ color: "inherit", background: "transparent", border: 0 }}
      >
        <img src={selected.flag} alt="" className="h-[14px] w-[21px] shrink-0 object-cover" />
        <span className="text-[12px] font-bold uppercase">{selected.value}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-[100] mt-2 min-w-[170px] overflow-hidden rounded-lg p-1 shadow-2xl"
          style={{ background: "#0a1430", border: "1px solid rgba(133,154,206,0.3)" }}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={locale === option.value}
              key={option.value}
              onClick={() => {
                setLocale(option.value);
                setOpen(false);
              }}
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[13px] font-semibold transition-colors"
              style={{
                color: locale === option.value ? "#39ff88" : "#f7faff",
                background: locale === option.value ? "rgba(57,255,136,0.12)" : "transparent",
              }}
            >
              <img src={option.flag} alt="" className="h-4 w-6 shrink-0 object-cover" />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const localizedLabels: Record<AppLocale, Record<string, string>> = {
  fr: {
    Adventure: "Aventure",
    Comedy: "Comédie",
    Drama: "Drame",
    Fantasy: "Fantastique",
    Horror: "Horreur",
    Mystery: "Mystère",
    Historical: "Historique",
    Sports: "Sport",
    Psychological: "Psychologique",
    "Science fiction": "Science-fiction",
    "Sci-fi": "Science-fiction",
    Ongoing: "En cours",
    Completed: "Terminé",
    New: "Nouveau",
    Artist: "Dessinateur",
    Writer: "Scénariste",
    Reader: "Lecteur",
    "Content creator": "Créateur de contenu",
  },
  en: {
    Aventure: "Adventure",
    Comédie: "Comedy",
    Drame: "Drama",
    Fantastique: "Fantasy",
    Horreur: "Horror",
    Mystère: "Mystery",
    Historique: "Historical",
    Sport: "Sports",
    Psychologique: "Psychological",
    "Science-fiction": "Science fiction",
    "Science fiction": "Science fiction",
    "Tranche de vie": "Slice of life",
    "En cours": "Ongoing",
    Terminé: "Completed",
    Nouveau: "New",
    Dessinateur: "Artist",
    Scénariste: "Writer",
    Lecteur: "Reader",
    "Créateur de contenu": "Content creator",
    Tout: "All",
    Rémunération: "Compensation",
    "Long terme": "Long term",
    Ponctuel: "One-off",
    "Sous-genre": "Subgenre",
    Langue: "Language",
    "Filtres avancés": "Advanced filters",
    Parrainage: "Sponsorship",
    "Type de vidéo": "Video type",
    "Durée de vidéo": "Video duration",
    Projet: "Project",
    Plateforme: "Platform",
    "Mode de paiement": "Payment method",
    "Nombre de chapitres minimum": "Minimum chapters",
    "Nombre de chapitres maximal": "Maximum chapters",
    "Nombre d'abonnés minimum": "Minimum followers",
    "Nombre d'abonnés maximal": "Maximum followers",
    Réinitialiser: "Reset",
    Appliquer: "Apply",
    "Post communautaire": "Community post",
    "Vidéo longue dédiée": "Dedicated long video",
    "Vidéo courte dédiée": "Dedicated short video",
    "Placement dans une vidéo": "Video placement",
    "Analyse profonde": "In-depth analysis",
    Présentation: "Presentation",
    Abonnement: "Subscription",
    "Paiement unique": "One-time payment",
    Négociable: "Negotiable",
  },
};

export function localizeLabel(label: string, locale: AppLocale) {
  return localizedLabels[locale][label] ?? label;
}
