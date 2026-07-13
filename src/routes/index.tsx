import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { useSession, signOut } from "@/lib/auth";

/**
 * Page d'introduction CollabManga (implémentation du design CollabManga.dc.html).
 * Le héros propose le choix entre les deux parties du site :
 *   - CollabManga (réseau)  → /hub
 *   - CollabManga AI        → /ai
 * Fonds du héros : /intro/hero-collab.jpg et /intro/hero-ai.jpg (public/intro/).
 */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CollabManga — Create manga together" },
      {
        name: "description",
        content:
          "CollabManga connects writers, artists, illustrators, content creators and readers to create, publish and grow original manga — with AI-assisted workflows.",
      },
    ],
  }),
  component: IntroPage,
});

const C = {
  bg: "#050B1D",
  panel: "#0B1430",
  card: "#101B3F",
  deep: "#08112B",
  text: "#F7FAFF",
  text2: "#B8C4E5",
  muted: "#7F8CB3",
  neon: "#39FF88",
  neonHover: "#25E575",
  border: "rgba(133,154,206,0.18)",
  borderStrong: "rgba(133,154,206,0.35)",
};

const sora: CSSProperties = { fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" };
const manrope: CSSProperties = { fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" };

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...manrope, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: C.neon }}>
      {children}
    </div>
  );
}

function PatternBox({ angle, neon, label }: { angle: number; neon?: boolean; label: string }) {
  const line = neon ? "rgba(57,255,136,0.08)" : "rgba(184,196,229,0.06)";
  return (
    <div
      style={{
        height: 320,
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
        background: C.card,
        border: `1px solid ${neon ? "rgba(57,255,136,0.25)" : C.border}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(${angle}deg, ${line} 0px, ${line} 2px, transparent 2px, transparent 24px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 12,
          letterSpacing: "0.08em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function HeroPanel({
  to,
  image,
  patternAngle,
  neonPattern,
  title,
  description,
  cta,
}: {
  to: string;
  image: string;
  patternAngle: number;
  neonPattern?: boolean;
  title: ReactNode;
  description: string;
  cta: string;
}) {
  const line = neonPattern ? "rgba(57,255,136,0.05)" : "rgba(184,196,229,0.06)";
  return (
    <Link to={to} className="intro-hero-panel" style={{ position: "relative", display: "block", overflow: "hidden", background: C.deep, cursor: "pointer" }}>
      {/* motif de secours (visible tant que l'image n'est pas fournie) */}
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
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      {/* voile de lisibilité */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(5,11,29,0.35) 0%, rgba(5,11,29,0.55) 55%, rgba(5,11,29,0.92) 100%)",
        }}
      />
      <div className="intro-hero-border" style={{ position: "absolute", inset: 0, border: "1px solid transparent", transition: "border-color .2s" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 48, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 44, letterSpacing: "-0.02em", color: C.text }}>{title}</div>
        <div style={{ ...manrope, fontSize: 17, lineHeight: 1.5, color: C.text2, maxWidth: 420 }}>{description}</div>
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
          {cta} <span>→</span>
        </div>
      </div>
    </Link>
  );
}

function HeaderAuth() {
  const { session, loading } = useSession();

  if (loading) return <div style={{ width: 180 }} />;

  if (session) {
    const meta = session.user.user_metadata as Record<string, string | undefined>;
    const name = meta?.username ?? meta?.full_name ?? meta?.name ?? session.user.email ?? "Mon compte";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ ...manrope, fontSize: 14, fontWeight: 700, color: C.neon }}>{name}</span>
        <button type="button" className="intro-btn-ghost" style={manrope} onClick={() => void signOut()}>
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Link to="/login" className="intro-btn-ghost" style={{ ...manrope, textDecoration: "none", display: "inline-block" }}>
        Log in
      </Link>
      <Link to="/signup" className="intro-btn-neon" style={{ ...manrope, textDecoration: "none", display: "inline-block" }}>
        Sign up
      </Link>
    </div>
  );
}

function IntroPage() {
  return (
    <div style={{ ...manrope, background: C.bg, color: C.text, width: "100%", minHeight: "100vh" }}>
      <style>{`
        /* Le héros remplit tout l'écran visible sous le header (80px) avant le premier scroll */
        .intro-hero-panel { height: calc(100vh - 80px); height: calc(100dvh - 80px); min-height: 520px; }
        .intro-hero-panel:hover .intro-hero-border { border-color: rgba(57,255,136,0.45); }
        .intro-hero-panel .intro-hero-img { transition: transform .35s ease; }
        .intro-hero-panel:hover .intro-hero-img { transform: scale(1.03); }
        .intro-nav-link { color: #B8C4E5; font-weight: 600; font-size: 15px; text-decoration: none; transition: color .15s; }
        .intro-nav-link:hover, .intro-nav-link.active { color: #39FF88; }
        .intro-btn-ghost { background: transparent; border: 1px solid rgba(133,154,206,0.35); color: #F7FAFF; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: all .15s; }
        .intro-btn-ghost:hover { border-color: #39FF88; color: #39FF88; }
        .intro-btn-neon { background: #39FF88; border: none; color: #050B1D; font-weight: 700; font-size: 14px; padding: 11px 22px; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: background .15s; }
        .intro-btn-neon:hover { background: #25E575; }
        .intro-btn-outline { width: fit-content; margin-top: 8px; border: 1px solid rgba(133,154,206,0.35); color: #F7FAFF; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 8px; text-decoration: none; transition: all .15s; display: inline-block; }
        .intro-btn-outline:hover { border-color: #39FF88; color: #39FF88; }
        @media (max-width: 900px) {
          .intro-hero { grid-template-columns: 1fr !important; }
          /* empilés sur mobile : les 2 panneaux partagent l'écran visible */
          .intro-hero-panel { height: calc(50vh - 41px); height: calc(50dvh - 41px); min-height: 380px; }
          .intro-split { grid-template-columns: 1fr !important; }
          .intro-nav { display: none !important; }
        }
      `}</style>

      {/* HEADER */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 80,
          boxSizing: "border-box",
          padding: "0 48px",
          background: "rgba(5,11,29,0.92)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>
            Collab<span style={{ color: C.neon }}>Manga</span>
          </div>
          <nav className="intro-nav" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <a href="#home" className="intro-nav-link active">Home</a>
            <Link to="/manga" className="intro-nav-link">Catalog</Link>
            <a href="#about" className="intro-nav-link">About</a>
            <a href="#ai" className="intro-nav-link">CollabManga AI</a>
          </nav>
        </div>
        <HeaderAuth />
      </header>

      {/* HERO : le choix des deux parties, images manga en fond */}
      <section
        id="home"
        className="intro-hero"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: C.border }}
      >
        <HeroPanel
          to="/hub"
          image="/intro/hero-collab.jpg"
          patternAngle={135}
          title="CollabManga"
          description="Create, organize, publish, and grow manga projects with other creators."
          cta="Enter CollabManga"
        />
        <HeroPanel
          to="/ai"
          image="/intro/hero-ai.jpg"
          patternAngle={45}
          neonPattern
          title="CollabManga AI"
          description="Use AI tools to accelerate manga page creation, characters, and chapters."
          cta="Open CollabManga AI"
        />
      </section>

      {/* PURPOSE */}
      <section style={{ padding: "120px 48px", background: C.panel, display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 760, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <Eyebrow>Our goal</Eyebrow>
          <h2 style={{ ...sora, fontWeight: 800, fontSize: 38, lineHeight: 1.2, margin: 0, color: C.text }}>
            Helping manga projects grow faster, and better
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: C.text2, margin: 0 }}>
            CollabManga gives creators the tools to collaborate, organize production, publish chapters, and gain
            visibility — with AI-assisted workflows available whenever they're needed. The platform is built to support
            the growth of original manga creation in Western markets, connecting writers, artists, illustrators,
            content creators, and readers in one place.
          </p>
        </div>
      </section>

      {/* CATALOG PREVIEW */}
      <section
        id="catalog"
        className="intro-split"
        style={{ padding: "100px 48px", background: C.bg, display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Eyebrow>Catalog</Eyebrow>
          <h3 style={{ ...sora, fontWeight: 800, fontSize: 32, margin: 0, color: C.text }}>Discover published manga</h3>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: C.text2, margin: 0, maxWidth: 440 }}>
            Explore original series and chapters published by the community — from early collaborations to finished
            releases.
          </p>
          <Link to="/manga" className="intro-btn-outline" style={manrope}>Explore the catalog</Link>
        </div>
        <PatternBox angle={115} label="catalog grid — placeholder" />
      </section>

      {/* ABOUT PREVIEW */}
      <section
        id="about"
        className="intro-split"
        style={{ padding: "100px 48px", background: C.panel, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center" }}
      >
        <PatternBox angle={65} label="team / community photo — placeholder" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Eyebrow>About</Eyebrow>
          <h3 style={{ ...sora, fontWeight: 800, fontSize: 32, margin: 0, color: C.text }}>Why CollabManga exists</h3>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: C.text2, margin: 0, maxWidth: 440 }}>
            CollabManga connects writers, artists, illustrators, and readers in one ecosystem built specifically for
            manga creation outside Japan — where finding the right collaborators is still hard.
          </p>
          <a href="#home" className="intro-btn-outline" style={manrope}>Learn more</a>
        </div>
      </section>

      {/* AI PREVIEW */}
      <section
        id="ai"
        className="intro-split"
        style={{ padding: "100px 48px", background: C.bg, display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Eyebrow>CollabManga AI</Eyebrow>
          <h3 style={{ ...sora, fontWeight: 800, fontSize: 32, margin: 0, color: C.text }}>
            AI tools built for manga production
          </h3>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: C.text2, margin: 0, maxWidth: 440 }}>
            Generate manga pages, keep characters consistent across chapters, and speed up production with style-aware
            AI assistance.
          </p>
          <Link to="/ai" className="intro-btn-outline" style={manrope}>Discover CollabManga AI</Link>
        </div>
        <PatternBox angle={45} neon label="AI page generation preview — placeholder" />
      </section>

      {/* FINAL CTA */}
      <section
        style={{
          padding: "140px 48px",
          background: C.panel,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
          textAlign: "center",
        }}
      >
        <h2 style={{ ...sora, fontWeight: 800, fontSize: 42, margin: 0, color: C.text, maxWidth: 640 }}>
          Start building your manga project
        </h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            to="/signup"
            className="intro-btn-neon"
            style={{ ...manrope, fontSize: 15, padding: "14px 28px", textDecoration: "none", display: "inline-block" }}
          >
            Sign up
          </Link>
          <Link to="/manga" className="intro-btn-outline" style={{ ...manrope, marginTop: 0, padding: "13px 27px" }}>
            Explore Catalog
          </Link>
          <Link
            to="/ai"
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
            Open CollabManga AI
          </Link>
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
        <div>© 2026 CollabManga. All rights reserved.</div>
      </footer>
    </div>
  );
}
