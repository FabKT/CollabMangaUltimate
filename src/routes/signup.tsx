import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { frenchAuthError } from "@/lib/auth";
import { AuthShell, AuthField, AuthError, AuthSuccess, AuthDivider, GoogleAuthButton, AC } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Inscription — CollabManga" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setError("Le service d'authentification n'est pas configuré.");
      return;
    }
    const name = username.trim();
    if (name.length < 3) {
      setError("Le nom d'utilisateur doit contenir au moins 3 caractères.");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
      setError("Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets, points et underscores.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    // Le trigger DB handle_new_user lit user_metadata.username / display_name
    // pour créer la ligne `profiles` automatiquement.
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: name, display_name: name } },
    });
    setLoading(false);

    if (err) {
      setError(frenchAuthError(err.message));
      return;
    }
    if (data.session) {
      // Confirmation e-mail désactivée : session immédiate.
      navigate({ to: "/" });
      return;
    }
    // Confirmation e-mail requise.
    setSuccess("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
  };

  return (
    <AuthShell title="Inscription" subtitle="Crée ton compte pour lancer tes projets manga et collaborer.">
      <AuthError message={error} />
      <AuthSuccess message={success} />
      <GoogleAuthButton onError={setError} />
      <AuthDivider />
      <form onSubmit={submit}>
        <AuthField label="Nom d'utilisateur" type="text" value={username} onChange={setUsername} placeholder="ex. inkwave_studio" autoComplete="username" />
        <AuthField label="Adresse e-mail" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" autoComplete="email" />
        <AuthField label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="6 caractères minimum" autoComplete="new-password" />
        <AuthField label="Confirmer le mot de passe" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" autoComplete="new-password" />
        <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? "Création du compte…" : "Créer mon compte"}
        </button>
      </form>
      <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 14, color: AC.text2 }}>
        Déjà un compte ?{" "}
        <Link to="/login" className="auth-link">
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}
