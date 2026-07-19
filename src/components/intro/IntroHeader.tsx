import { Link } from "@tanstack/react-router";
import { useSession, signOut } from "@/lib/auth";
import { C, sora, manrope } from "./intro-theme";
import { LanguageSelect, useI18n } from "@/lib/i18n";

/** Boutons d'authentification du header public (connexion / compte). */
function HeaderAuth() {
  const { session, loading } = useSession();
  const { t } = useI18n();

  if (loading) return <div style={{ width: 180 }} />;

  if (session) {
    const meta = session.user.user_metadata as Record<string, string | undefined>;
    const name =
      meta?.username ?? meta?.full_name ?? meta?.name ?? session.user.email ?? "Mon compte";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ ...manrope, fontSize: 14, fontWeight: 700, color: C.neon }}>{name}</span>
        <button
          type="button"
          className="intro-btn-ghost"
          style={manrope}
          onClick={() => void signOut()}
        >
          {t("auth.signOut")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Link
        to="/login"
        className="intro-btn-ghost"
        style={{ ...manrope, textDecoration: "none", display: "inline-block" }}
      >
        {t("auth.login")}
      </Link>
      <Link
        to="/signup"
        className="intro-btn-neon"
        style={{ ...manrope, textDecoration: "none", display: "inline-block" }}
      >
        {t("auth.signup")}
      </Link>
    </div>
  );
}

/**
 * Header public partagé (page d'introduction + pages publiques /discover).
 * Les liens de navigation sont des ancres absolues (/#section) : sur la landing
 * ils défilent vers la section ; depuis une page /discover ils ramènent à la
 * landing sur la bonne section.
 */
export function IntroHeader() {
  const { t } = useI18n();
  return (
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
        <Link
          to="/"
          style={{
            ...sora,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: C.text,
            textDecoration: "none",
          }}
        >
          Collab<span style={{ color: C.neon }}>Manga</span>
        </Link>
        <nav className="intro-nav" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="/#home" className="intro-nav-link">
            {t("intro.home")}
          </a>
          <a href="/#about" className="intro-nav-link">
            {t("intro.about")}
          </a>
          <a href="/#ai" className="intro-nav-link">
            CollabManga AI
          </a>
          <a href="/#catalog" className="intro-nav-link">
            {t("intro.catalog")}
          </a>
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LanguageSelect className="h-10 min-w-[104px] rounded-lg border border-[rgba(133,154,206,0.3)] bg-[#0b1430] text-[#f7faff]" />
        <HeaderAuth />
      </div>
    </header>
  );
}
