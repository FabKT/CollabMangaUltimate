import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { frenchAuthError } from "@/lib/auth";
import { AuthShell, AuthField, AuthError, AuthDivider, GoogleAuthButton, AC } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — CollabManga" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supabase) {
      setError("Le service d'authentification n'est pas configuré.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(frenchAuthError(err.message));
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <AuthShell title="Connexion" subtitle="Content de te revoir ! Connecte-toi pour retrouver tes projets.">
      <AuthError message={error} />
      <GoogleAuthButton onError={setError} />
      <AuthDivider />
      <form onSubmit={submit}>
        <AuthField label="Adresse e-mail" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" autoComplete="email" />
        <AuthField label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
        <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 14, color: AC.text2 }}>
        Pas encore de compte ?{" "}
        <Link to="/signup" className="auth-link">
          S'inscrire
        </Link>
      </p>
    </AuthShell>
  );
}
