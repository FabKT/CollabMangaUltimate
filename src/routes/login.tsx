import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AC,
  AuthDivider,
  AuthError,
  AuthField,
  AuthShell,
  GoogleAuthButton,
} from "@/components/auth/AuthShell";
import { frenchAuthError } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in - CollabManga" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Authentication is not configured.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(frenchAuthError(authError.message));
      return;
    }
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    const destination = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/hub";
    window.location.assign(destination);
  };

  return (
    <AuthShell title={t("auth.login")} subtitle={t("auth.loginSubtitle")}>
      <AuthError message={error} />
      <GoogleAuthButton onError={setError} />
      <AuthDivider />
      <form onSubmit={submit}>
        <AuthField
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <AuthField
          label={t("auth.password")}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? t("auth.loggingIn") : t("auth.login")}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 14, color: AC.text2 }}>
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="auth-link">
          {t("auth.signup")}
        </Link>
      </p>
    </AuthShell>
  );
}
