import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AC,
  AuthDivider,
  AuthError,
  AuthField,
  AuthShell,
  AuthSuccess,
  GoogleAuthButton,
} from "@/components/auth/AuthShell";
import { frenchAuthError } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up - CollabManga" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!supabase) {
      setError("Authentication is not configured.");
      return;
    }
    if (password.length < 6) {
      setError(
        locale === "fr"
          ? "Le mot de passe doit contenir au moins 6 caractères."
          : "The password must contain at least 6 characters.",
      );
      return;
    }
    if (password !== confirm) {
      setError(
        locale === "fr"
          ? "Les deux mots de passe ne correspondent pas."
          : "The passwords do not match.",
      );
      return;
    }

    setLoading(true);
    const temporaryUsername = `pending_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: {
          username: temporaryUsername,
          display_name: temporaryUsername,
          site_locale: locale,
          onboarding_completed: false,
        },
      },
    });
    setLoading(false);

    if (authError) {
      setError(frenchAuthError(authError.message));
      return;
    }
    if (data.session) {
      navigate({ to: "/onboarding" });
      return;
    }
    setSuccess(
      locale === "fr"
        ? "Compte créé. Confirme ton adresse e-mail, puis termine la configuration de ton profil."
        : "Account created. Confirm your email address, then finish setting up your profile.",
    );
  };

  return (
    <AuthShell title={t("auth.signup")} subtitle={t("auth.signupSubtitle")}>
      <AuthError message={error} />
      <AuthSuccess message={success} />
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
          placeholder="6 characters minimum"
          autoComplete="new-password"
        />
        <AuthField
          label={t("auth.confirmPassword")}
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? t("auth.creating") : t("auth.create")}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 14, color: AC.text2 }}>
        {t("auth.hasAccount")}{" "}
        <Link to="/login" className="auth-link">
          {t("auth.login")}
        </Link>
      </p>
    </AuthShell>
  );
}
