import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { frenchAuthError } from "@/lib/auth";
import { LanguageSelect, useI18n } from "@/lib/i18n";

/** Habillage commun des pages Connexion / Inscription (style page d'intro). */

export const AC = {
  bg: "#050B1D",
  panel: "#0B1430",
  card: "#101B3F",
  input: "#0E193A",
  text: "#F7FAFF",
  text2: "#B8C4E5",
  muted: "#7F8CB3",
  neon: "#39FF88",
  danger: "#FF5F7E",
  border: "rgba(133,154,206,0.18)",
  borderStrong: "rgba(133,154,206,0.35)",
};

export const authSora: CSSProperties = {
  fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif",
};
export const authManrope: CSSProperties = {
  fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
};

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        ...authManrope,
        minHeight: "100vh",
        background: `radial-gradient(90% 60% at 50% 0%, #0B1430 0%, ${AC.bg} 60%)`,
        color: AC.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 16px 64px",
      }}
    >
      <style>{`
        .auth-input { width:100%; box-sizing:border-box; height:48px; border-radius:12px; border:1px solid ${AC.border}; background:${AC.input}; padding:0 16px; font-size:14px; font-weight:500; color:${AC.text}; outline:none; transition:border-color .15s, box-shadow .15s; font-family:'Manrope',sans-serif; }
        .auth-input::placeholder { color:${AC.muted}; }
        .auth-input:focus { border-color:${AC.neon}; box-shadow:0 0 0 3px rgba(57,255,136,0.10); }
        .auth-submit { width:100%; height:50px; border:none; border-radius:12px; background:${AC.neon}; color:#04111E; font-weight:800; font-size:15px; cursor:pointer; transition:background .15s; font-family:'Manrope',sans-serif; }
        .auth-submit:hover { background:#25E575; }
        .auth-submit:disabled { opacity:.6; cursor:not-allowed; }
        .auth-link { color:${AC.neon}; font-weight:700; text-decoration:none; }
        .auth-link:hover { color:#25E575; }
        .auth-google { width:100%; height:50px; display:flex; align-items:center; justify-content:center; gap:10px; border-radius:12px; border:1px solid ${AC.borderStrong}; background:${AC.card}; color:${AC.text}; font-weight:700; font-size:15px; cursor:pointer; transition:border-color .15s, background .15s; font-family:'Manrope',sans-serif; }
        .auth-google:hover { border-color:${AC.neon}; background:#152048; }
      `}</style>

      <LanguageSelect className="auth-input !fixed !right-5 !top-5 !h-10 !w-[72px]" />

      {/* logo → retour à l'intro */}
      <Link
        to="/"
        style={{
          ...authSora,
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: "-0.02em",
          color: AC.text,
          textDecoration: "none",
          padding: "40px 0 36px",
        }}
      >
        Collab<span style={{ color: AC.neon }}>Manga</span>
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: AC.panel,
          border: `1px solid ${AC.border}`,
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        }}
      >
        <h1 style={{ ...authSora, fontWeight: 800, fontSize: 26, margin: 0, color: AC.text }}>
          {title}
        </h1>
        <p style={{ margin: "8px 0 26px", fontSize: 14, lineHeight: 1.6, color: AC.text2 }}>
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/** Bouton « Continuer avec Google » (OAuth Supabase, redirection pleine page). */
export function GoogleAuthButton({ onError }: { onError: (message: string) => void }) {
  const { t } = useI18n();
  const click = async () => {
    if (!supabase) {
      onError("Le service d'authentification n'est pas configuré.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // On revient directement dans l'app (évite la landing lourde) et on saute
        // la sélection de compte pour accélérer le retour.
        redirectTo: `${window.location.origin}/onboarding`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) onError(frenchAuthError(error.message));
  };
  return (
    <button type="button" className="auth-google" onClick={() => void click()}>
      <GoogleLogo />
      {t("auth.google")}
    </button>
  );
}

/** Séparateur « ou » entre Google et le formulaire classique. */
export function AuthDivider() {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <span style={{ flex: 1, height: 1, background: AC.border }} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: AC.muted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {t("auth.or")}
      </span>
      <span style={{ flex: 1, height: 1, background: AC.border }} />
    </div>
  );
}

export function AuthField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span
        style={{
          display: "block",
          marginBottom: 7,
          fontSize: 13,
          fontWeight: 700,
          color: AC.text2,
        }}
      >
        {label}
      </span>
      <input
        className="auth-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        marginBottom: 16,
        padding: "11px 14px",
        borderRadius: 10,
        background: "rgba(255,95,126,0.10)",
        border: "1px solid rgba(255,95,126,0.35)",
        color: AC.danger,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        marginBottom: 16,
        padding: "11px 14px",
        borderRadius: 10,
        background: "rgba(57,255,136,0.10)",
        border: "1px solid rgba(57,255,136,0.4)",
        color: AC.neon,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}
