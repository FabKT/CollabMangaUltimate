import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/_collab/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — CollabManga" },
      {
        name: "description",
        content:
          "Paramètres CollabManga : conditions d'utilisation, confidentialité, règles communautaires, IA, FAQ et support.",
      },
    ],
  }),
  component: SettingsPage,
});

type TextSection = {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: TranslationKey;
  introKey: TranslationKey;
  itemKeys: TranslationKey[];
};

type FaqItem = {
  questionKey: TranslationKey;
  answerKey: TranslationKey;
};

const documentSections: TextSection[] = [
  {
    icon: Scale,
    titleKey: "settings.termsTitle",
    introKey: "settings.termsIntro",
    itemKeys: ["settings.termsUse1", "settings.termsUse2", "settings.termsUse3"],
  },
  {
    icon: LockKeyhole,
    titleKey: "settings.privacyTitle",
    introKey: "settings.privacyIntro",
    itemKeys: ["settings.privacyData1", "settings.privacyData2", "settings.privacyData3"],
  },
  {
    icon: Sparkles,
    titleKey: "settings.aiTitle",
    introKey: "settings.aiIntro",
    itemKeys: ["settings.aiRule1", "settings.aiRule2", "settings.aiRule3"],
  },
  {
    icon: Users,
    titleKey: "settings.communityTitle",
    introKey: "settings.communityIntro",
    itemKeys: ["settings.communityRule1", "settings.communityRule2", "settings.communityRule3"],
  },
];

const faqItems: FaqItem[] = [
  { questionKey: "settings.faqCreditsQ", answerKey: "settings.faqCreditsA" },
  { questionKey: "settings.faqProjectsQ", answerKey: "settings.faqProjectsA" },
  { questionKey: "settings.faqContactQ", answerKey: "settings.faqContactA" },
  { questionKey: "settings.faqDataQ", answerKey: "settings.faqDataA" },
];

function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen px-4 py-6 text-text-primary md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neon-soft-border bg-neon-soft px-3 py-1 text-xs font-bold text-neon">
              <ShieldCheck className="h-4 w-4" />
              {t("settings.lastUpdated")}
            </div>
            <h1 className="cma-page-title">{t("settings.title")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              {t("settings.subtitle")}
            </p>
          </div>
          <div className="rounded-2xl border border-border-default bg-bg-panel px-4 py-3 text-sm leading-6 text-text-secondary lg:max-w-md">
            {t("settings.profileHint")}
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <QuickLink
            to="/profile"
            icon={User}
            title={t("settings.openAccount")}
            description={t("profile.identitySubtitle")}
          />
          <QuickLink
            to="/notifications"
            icon={Bell}
            title={t("settings.openNotifications")}
            description={t("profile.securitySubtitle")}
          />
          <QuickLink
            to="/ai/plan"
            icon={CreditCard}
            title={t("settings.openBilling")}
            description={t("profile.aiPlanSubtitle")}
          />
        </section>

        <main className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="cma-panel overflow-hidden">
            <div className="border-b border-border-default px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-neon" />
                <h2 className="font-display text-lg font-bold">{t("settings.platformDocs")}</h2>
              </div>
            </div>
            <div className="divide-y divide-border-default">
              {documentSections.map((section) => (
                <DocumentBlock key={section.titleKey} section={section} />
              ))}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <section className="cma-panel p-5">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-neon" />
                <h2 className="font-display text-lg font-bold">{t("settings.faqTitle")}</h2>
              </div>
              <div className="mt-4 space-y-2">
                {faqItems.map((item) => (
                  <FaqDetails key={item.questionKey} item={item} />
                ))}
              </div>
            </section>

            <section className="cma-panel p-5">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-neon" />
                <h2 className="font-display text-lg font-bold">{t("settings.supportTitle")}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                {t("settings.supportIntro")}
              </p>
              <a
                className="cma-btn-primary mt-5 w-full justify-center"
                href={`mailto:${t("settings.supportEmail")}`}
              >
                <Mail className="h-4 w-4" />
                {t("settings.contactSupport")}
              </a>
            </section>

            <section className="rounded-2xl border border-border-default bg-bg-input p-4 text-xs leading-5 text-text-muted">
              {t("settings.legalNote")}
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: "/profile" | "/notifications" | "/ai/plan";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border-default bg-bg-panel p-4 transition hover:border-neon-soft-border hover:bg-bg-elevated"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon-soft text-neon">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-bold text-text-primary">{title}</span>
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-text-muted">
            {description}
          </span>
        </span>
      </div>
    </Link>
  );
}

function DocumentBlock({ section }: { section: TextSection }) {
  const { t } = useI18n();
  const Icon = section.icon;
  return (
    <article className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:gap-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neon-soft-border bg-neon-soft text-neon">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold">{t(section.titleKey)}</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{t(section.introKey)}</p>
          <ul className="mt-4 grid gap-2">
            {section.itemKeys.map((itemKey) => (
              <li key={itemKey} className="flex gap-2 text-sm leading-6 text-text-secondary">
                <BookOpenCheck className="mt-1 h-4 w-4 shrink-0 text-neon" />
                <span>{t(itemKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function FaqDetails({ item }: { item: FaqItem }) {
  const { t } = useI18n();
  return (
    <details className="group rounded-xl border border-border-default bg-bg-input px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-text-primary">
        <span>{t(item.questionKey)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{t(item.answerKey)}</p>
    </details>
  );
}
