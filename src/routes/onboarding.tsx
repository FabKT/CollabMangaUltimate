import { createFileRoute } from "@tanstack/react-router";
import { Camera, Check, Upload, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthError, AuthShell, AC, authManrope } from "@/components/auth/AuthShell";
import { uploadImage } from "@/lib/db";
import { errorMessage } from "@/lib/error-message";
import { type AppLocale, useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Profile setup - CollabManga" }] }),
  component: OnboardingPage,
});

const ROLES = ["Dessinateur", "Scénariste", "Créateur de contenu", "Lecteur"] as const;
type Role = (typeof ROLES)[number];

function roleKey(role: Role) {
  if (role === "Dessinateur") return "role.artist" as const;
  if (role === "Scénariste") return "role.writer" as const;
  if (role === "Créateur de contenu") return "role.contentCreator" as const;
  return "role.reader" as const;
}

function OnboardingPage() {
  const { locale, setLocale, t } = useI18n();
  const [username, setUsername] = useState("");
  const [primaryRole, setPrimaryRole] = useState<Role>("Dessinateur");
  const [secondaryRole, setSecondaryRole] = useState<Role | "">("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      setError("Supabase is not configured.");
      setChecking(false);
      return;
    }
    void sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.assign("/login?redirect=/onboarding");
        return;
      }
      const metadata = data.session.user.user_metadata as Record<string, unknown>;
      const { data: profile } = await sb
        .from("profiles")
        .select("username, role, secondary_role, site_locale, onboarding_completed")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.onboarding_completed) {
        window.location.assign("/hub");
        return;
      }
      const currentName = String(profile?.username ?? metadata.username ?? "");
      if (currentName && !currentName.startsWith("pending_")) setUsername(currentName);
      if (ROLES.includes(profile?.role as Role)) setPrimaryRole(profile?.role as Role);
      if (ROLES.includes(profile?.secondary_role as Role)) {
        setSecondaryRole(profile?.secondary_role as Role);
      }
      if (profile?.site_locale === "fr" || profile?.site_locale === "en") {
        setLocale(profile.site_locale);
      }
      setChecking(false);
    });
  }, [setLocale]);

  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const secondaryRoles = useMemo(() => ROLES.filter((role) => role !== primaryRole), [primaryRole]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setError(
        locale === "fr"
          ? "Le nom d'utilisateur doit contenir au moins 3 caractères et uniquement des lettres, chiffres, points, tirets ou underscores."
          : "The username must contain at least 3 characters and only letters, numbers, dots, dashes or underscores.",
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("Session expired.");
      const avatarUrl = avatar ? await uploadImage(avatar, "avatars") : null;
      const profilePatch = {
        username: cleanUsername,
        display_name: cleanUsername,
        role: primaryRole,
        secondary_role: secondaryRole || null,
        site_locale: locale,
        onboarding_completed: true,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      };
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profilePatch)
        .eq("id", user.id);
      if (profileError) throw profileError;
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...profilePatch,
          avatar_url: avatarUrl ?? undefined,
        },
      });
      if (metadataError) throw metadataError;
      window.location.assign("/hub");
    } catch (reason) {
      const message = errorMessage(reason);
      setError(
        /duplicate|username/i.test(message)
          ? locale === "fr"
            ? "Ce nom d'utilisateur est déjà utilisé."
            : "This username is already in use."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div
        className="grid min-h-screen place-items-center"
        style={{ background: AC.bg, color: AC.text }}
      >
        {t("common.loading")}
      </div>
    );
  }

  return (
    <AuthShell title={t("onboarding.title")} subtitle={t("onboarding.subtitle")}>
      <AuthError message={error} />
      <form onSubmit={submit} style={authManrope}>
        <div className="mb-5 flex flex-col items-center">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group relative grid h-28 w-28 place-items-center overflow-hidden rounded-full border"
            style={{ background: AC.input, borderColor: AC.borderStrong }}
          >
            {preview ? (
              <img src={preview} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-11 w-11" style={{ color: AC.muted }} />
            )}
            <span className="absolute inset-x-0 bottom-0 grid h-9 place-items-center bg-black/65">
              <Camera className="h-4 w-4 text-white" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="auth-link mt-3 inline-flex items-center gap-2 text-sm"
          >
            <Upload className="h-4 w-4" /> {t("onboarding.avatar")}
          </button>
        </div>

        <label className="mb-4 block">
          <span className="mb-2 block text-[13px] font-bold" style={{ color: AC.text2 }}>
            {t("onboarding.username")}
          </span>
          <input
            className="auth-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold" style={{ color: AC.text2 }}>
              {t("onboarding.primaryRole")}
            </span>
            <select
              className="auth-input"
              value={primaryRole}
              onChange={(event) => {
                const role = event.target.value as Role;
                setPrimaryRole(role);
                if (secondaryRole === role) setSecondaryRole("");
              }}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(roleKey(role))}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold" style={{ color: AC.text2 }}>
              {t("onboarding.secondaryRole")}
            </span>
            <select
              className="auth-input"
              value={secondaryRole}
              onChange={(event) => setSecondaryRole(event.target.value as Role | "")}
            >
              <option value="">{t("onboarding.noSecondaryRole")}</option>
              {secondaryRoles.map((role) => (
                <option key={role} value={role}>
                  {t(roleKey(role))}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-[13px] font-bold" style={{ color: AC.text2 }}>
            {t("onboarding.siteLanguage")}
          </span>
          <select
            className="auth-input"
            value={locale}
            onChange={(event) => setLocale(event.target.value as AppLocale)}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>

        <button
          type="submit"
          className="auth-submit mt-6 inline-flex items-center justify-center gap-2"
          disabled={loading}
        >
          <Check className="h-4 w-4" />
          {loading ? t("common.loading") : t("onboarding.finish")}
        </button>
      </form>
    </AuthShell>
  );
}
