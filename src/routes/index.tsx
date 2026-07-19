import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Users,
  Sparkles,
  PenLine,
  Palette,
  Megaphone,
  Layers,
  UserCheck,
  Wand2,
  Rocket,
  FolderKanban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IntroHeader } from "@/components/intro/IntroHeader";
import { C, sora, manrope } from "@/components/intro/intro-theme";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { CatalogPage } from "./_collab.manga.index";

/**
 * Page d'introduction CollabManga — 100 % texte + cadres (aucune image à
 * intégrer). Le héros propose le choix entre les deux parties du site :
 *   - CollabManga (réseau)  → /hub
 *   - CollabManga AI        → /ai
 */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CollabManga — Create manga together" },
      {
        name: "description",
        content:
          "CollabManga connects writers, artists, content creators and readers to create, publish and grow original manga — with AI-assisted workflows.",
      },
    ],
  }),
  component: IntroPage,
});

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        ...manrope,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.neon,
      }}
    >
      {children}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
  neon,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  neon?: boolean;
}) {
  return (
    <div
      className="intro-card"
      style={{
        background: C.card,
        border: `1px solid ${neon ? "rgba(57,255,136,0.28)" : C.border}`,
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "rgba(57,255,136,0.10)",
          border: "1px solid rgba(57,255,136,0.30)",
        }}
      >
        <Icon size={20} color={C.neon} />
      </div>
      <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: C.text }}>{title}</div>
      <div style={{ ...manrope, fontSize: 14, lineHeight: 1.6, color: C.text2 }}>{text}</div>
    </div>
  );
}

function CardGrid({ min = 220, children }: { min?: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

function HeroPanel({
  href,
  image,
  patternAngle,
  neonPattern,
  title,
  description,
  cta,
}: {
  href: string;
  image: string;
  patternAngle: number;
  neonPattern?: boolean;
  title: ReactNode;
  description: string;
  cta: string;
}) {
  const line = neonPattern ? "rgba(57,255,136,0.05)" : "rgba(184,196,229,0.06)";
  return (
    <a
      href={href}
      className="intro-hero-panel"
      style={{
        position: "relative",
        display: "block",
        overflow: "hidden",
        background: C.deep,
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      {/* motif de secours (visible tant que l'image n'est pas chargée) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(${patternAngle}deg, ${line} 0px, ${line} 2px, transparent 2px, transparent 26px), linear-gradient(160deg, ${C.card} 0%, ${C.deep} 70%)`,
        }}
      />
      {/* image manga de fond */}
      <img
        src={image}
        alt=""
        aria-hidden
        className="intro-hero-img"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 20%",
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      {/* voile de lisibilité */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,11,29,0.35) 0%, rgba(5,11,29,0.55) 55%, rgba(5,11,29,0.92) 100%)",
        }}
      />
      <div
        className="intro-hero-border"
        style={{
          position: "absolute",
          inset: 0,
          border: "1px solid transparent",
          transition: "border-color .2s",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            ...sora,
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: "-0.02em",
            color: C.text,
          }}
        >
          {title}
        </div>
        <div style={{ ...manrope, fontSize: 17, lineHeight: 1.5, color: C.text2, maxWidth: 420 }}>
          {description}
        </div>
        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "fit-content",
            background: "rgba(57,255,136,0.12)",
            border: "1px solid rgba(57,255,136,0.4)",
            color: C.neon,
            fontWeight: 700,
            fontSize: 15,
            padding: "12px 22px",
            borderRadius: 8,
            ...manrope,
          }}
        >
          {cta} <ArrowRight size={16} />
        </div>
      </div>
    </a>
  );
}

function IntroPage() {
  const { session } = useSession();
  const { t } = useI18n();
  const collabDestination = session ? "/hub" : "/login?redirect=%2Fhub";
  const aiDestination = session ? "/ai" : "/login?redirect=%2Fai";

  return (
    <div style={{ ...manrope, background: C.bg, color: C.text, width: "100%", minHeight: "100vh" }}>
      <IntroHeader />

      {/* HERO : choix des deux parties (texte + cadres) */}
      <section
        id="home"
        className="intro-hero"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: C.border }}
      >
        <HeroPanel
          href={collabDestination}
          image="/intro/hero-collab.jpg"
          patternAngle={135}
          title="CollabManga"
          description={t("intro.collabDescription")}
          cta={t("intro.collabCta")}
        />
        <HeroPanel
          href={aiDestination}
          image="/intro/hero-ai.jpg"
          patternAngle={45}
          neonPattern
          title="CollabManga AI"
          description={t("intro.aiDescription")}
          cta={t("intro.aiCta")}
        />
      </section>

      {/* PURPOSE */}
      <section className="intro-section" style={{ background: C.panel }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <Eyebrow>{t("intro.goal")}</Eyebrow>
          <h2
            style={{
              ...sora,
              fontWeight: 800,
              fontSize: 38,
              lineHeight: 1.2,
              margin: 0,
              color: C.text,
            }}
          >
            {t("intro.goalTitle")}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: C.text2, margin: 0 }}>
            {t("intro.goalText")}
          </p>
        </div>
        <div style={{ maxWidth: 960, margin: "48px auto 0" }}>
          <CardGrid min={240}>
            <FeatureCard
              icon={Users}
              title={t("intro.collaborate")}
              text={t("intro.collaborateText")}
            />
            <FeatureCard
              icon={FolderKanban}
              title={t("intro.organize")}
              text={t("intro.organizeText")}
            />
            <FeatureCard icon={Rocket} title={t("intro.publish")} text={t("intro.publishText")} />
          </CardGrid>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="intro-section" style={{ background: C.panel }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
            <Eyebrow>{t("intro.about")}</Eyebrow>
            <h3 style={{ ...sora, fontWeight: 800, fontSize: 32, margin: 0, color: C.text }}>
              {t("intro.whyTitle")}
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: C.text2, margin: 0 }}>
              {t("intro.whyText")}
            </p>
          </div>
          <CardGrid min={200}>
            <FeatureCard icon={PenLine} title={t("role.writer")} text={t("intro.writersText")} />
            <FeatureCard icon={Palette} title={t("role.artist")} text={t("intro.artistsText")} />
            <FeatureCard
              icon={Megaphone}
              title={t("role.contentCreator")}
              text={t("intro.contentCreatorsText")}
            />
            <FeatureCard icon={UserCheck} title={t("role.reader")} text={t("intro.readersText")} />
          </CardGrid>
        </div>
      </section>

      {/* AI */}
      <section id="ai" className="intro-section" style={{ background: C.bg }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
            <Eyebrow>CollabManga AI</Eyebrow>
            <h3 style={{ ...sora, fontWeight: 800, fontSize: 32, margin: 0, color: C.text }}>
              {t("intro.aiTitle")}
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: C.text2, margin: 0 }}>
              {t("intro.aiText")}
            </p>
            <a href={aiDestination} className="intro-btn-outline" style={manrope}>
              {t("intro.discoverAi")} <ArrowRight size={16} />
            </a>
          </div>
          <CardGrid min={240}>
            <FeatureCard
              icon={Layers}
              neon
              title="Manga Page Creator"
              text={t("intro.pageCreatorText")}
            />
            <FeatureCard
              icon={UserCheck}
              neon
              title={t("intro.consistency")}
              text={t("intro.consistencyText")}
            />
            <FeatureCard
              icon={Wand2}
              neon
              title={t("nav.styleTransfer")}
              text={t("intro.styleTransferText")}
            />
            <FeatureCard icon={Sparkles} neon title="Raw to Final" text={t("intro.rawFinalText")} />
          </CardGrid>
        </div>
      </section>

      {/* Full public catalog. This is intentionally the last navigable section. */}
      <section
        id="catalog"
        className="intro-section"
        style={{ background: C.panel, borderTop: `1px solid ${C.border}` }}
      >
        <CatalogPage publicMode embedded />
      </section>

      {/* FINAL CTA */}
      <section
        className="intro-section"
        style={{
          background: C.panel,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
          textAlign: "center",
          paddingTop: 140,
          paddingBottom: 140,
        }}
      >
        <h2
          style={{
            ...sora,
            fontWeight: 800,
            fontSize: 42,
            margin: 0,
            color: C.text,
            maxWidth: 640,
          }}
        >
          {t("intro.finalTitle")}
        </h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            to="/signup"
            className="intro-btn-neon"
            style={{
              ...manrope,
              fontSize: 15,
              padding: "14px 28px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            {t("intro.signup")}
          </Link>
          <a
            href="/#catalog"
            className="intro-btn-outline"
            style={{ ...manrope, marginTop: 0, padding: "13px 27px" }}
          >
            {t("intro.exploreCatalog")}
          </a>
          <a
            href={aiDestination}
            style={{
              ...manrope,
              background: "transparent",
              border: "1px solid rgba(57,255,136,0.4)",
              color: C.neon,
              fontWeight: 600,
              fontSize: 15,
              padding: "13px 27px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            {t("intro.aiCta")}
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          padding: "32px 48px",
          background: C.bg,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: C.muted,
          fontSize: 13,
        }}
      >
        <div style={{ ...sora, fontWeight: 700, color: C.text2 }}>
          Collab<span style={{ color: C.neon }}>Manga</span>
        </div>
        <div>© 2026 CollabManga. {t("intro.rights")}</div>
      </footer>
    </div>
  );
}
