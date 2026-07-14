import { getSupabase, supabase } from "./supabase";

/**
 * Couche de données CollabManga — tout le contenu réel passe par ici.
 * Tables : illustrations, announcements, ideas, conversations/messages (Realtime).
 * Images : bucket public `media`, chemin `<uid>/<dossier>/<fichier>` (imposé par la RLS Storage).
 */

export type DbProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type DbIllustration = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  author: DbProfile | null;
};

export type DbAnnouncement = {
  id: string;
  author_id: string;
  mode: "project" | "collaborator";
  title: string;
  hook: string;
  description: string;
  language: string;
  status_sought: string;
  genres: string[];
  subgenres: string[];
  project_title: string | null;
  created_at: string;
  author: DbProfile | null;
};

export type DbIdea = {
  id: string;
  author_id: string;
  title: string;
  category: string;
  description: string;
  image_url: string | null;
  created_at: string;
  author: DbProfile | null;
};

export type DbConversation = {
  id: string;
  created_at: string;
  others: DbProfile[];
  lastMessage: { content: string; created_at: string } | null;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

const PROFILE_COLS = "id, username, display_name, avatar_url";

/** Utilisateur connecté (ou null). */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Upload d'une image dans le bucket `media`. Retourne l'URL publique. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour importer une image.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, {
    contentType: file.type || "image/png",
    upsert: false,
  });
  if (error) throw new Error(`Échec de l'upload : ${error.message}`);
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/* ---------------- illustrations ---------------- */

export async function listIllustrations(): Promise<DbIllustration[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("illustrations")
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbIllustration[];
}

export async function addIllustration(input: { title: string; description: string; file: File }) {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour publier une illustration.");
  const image_url = await uploadImage(input.file, "illustrations");
  const { data, error } = await sb
    .from("illustrations")
    .insert({ author_id: uid, title: input.title, description: input.description, image_url })
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .single();
  if (error) throw new Error(error.message);
  return data as DbIllustration;
}

/* ---------------- annonces ---------------- */

export async function listAnnouncements(): Promise<DbAnnouncement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("announcements")
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbAnnouncement[];
}

export async function addAnnouncement(input: {
  mode: "project" | "collaborator";
  title: string;
  hook: string;
  description: string;
  language: string;
  status_sought: string;
  genres: string[];
  subgenres: string[];
  project_title?: string;
}) {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour publier une annonce.");
  const { data, error } = await sb
    .from("announcements")
    .insert({ ...input, author_id: uid })
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .single();
  if (error) throw new Error(error.message);
  return data as DbAnnouncement;
}

/* ---------------- idées / propositions ---------------- */

export async function listIdeas(): Promise<DbIdea[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ideas")
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbIdea[];
}

export async function addIdea(input: { title: string; category: string; description: string; file?: File | null }) {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour publier une proposition.");
  const image_url = input.file ? await uploadImage(input.file, "ideas") : null;
  const { data, error } = await sb
    .from("ideas")
    .insert({ author_id: uid, title: input.title, category: input.category, description: input.description, image_url })
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .single();
  if (error) throw new Error(error.message);
  return data as DbIdea;
}

/* ---------------- messagerie ---------------- */

export async function listConversations(): Promise<DbConversation[]> {
  if (!supabase) return [];
  const uid = await currentUserId();
  if (!uid) return [];

  const { data: convs, error } = await supabase
    .from("conversations")
    .select(`id, created_at, conversation_members(profile_id, profile:profiles(${PROFILE_COLS}))`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const list = (convs ?? []) as unknown as Array<{
    id: string;
    created_at: string;
    conversation_members: Array<{ profile_id: string; profile: DbProfile | null }>;
  }>;
  if (list.length === 0) return [];

  // dernier message de chaque conversation (une seule requête)
  const ids = list.map((c) => c.id);
  const { data: lasts } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });
  const lastByConv = new Map<string, { content: string; created_at: string }>();
  for (const m of lasts ?? []) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, { content: m.content, created_at: m.created_at });
    }
  }

  return list.map((c) => ({
    id: c.id,
    created_at: c.created_at,
    others: c.conversation_members
      .filter((m) => m.profile_id !== uid && m.profile)
      .map((m) => m.profile as DbProfile),
    lastMessage: lastByConv.get(c.id) ?? null,
  }));
}

/** Ouvre (ou réutilise) une conversation 1:1 avec un autre profil. Retourne son id. */
export async function startConversationWith(otherProfileId: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("start_conversation", { other_profile: otherProfileId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listMessages(conversationId: string): Promise<DbMessage[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbMessage[];
}

export async function sendMessage(conversationId: string, content: string, file?: File | null): Promise<DbMessage> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour envoyer un message.");
  const image_url = file ? await uploadImage(file, "messages") : null;
  const { data, error } = await sb
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: uid, content, image_url })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DbMessage;
}

/** Abonnement Realtime aux nouveaux messages d'une conversation. Retourne un unsubscribe. */
export function subscribeMessages(conversationId: string, onInsert: (m: DbMessage) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as DbMessage),
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}

/** Recherche de profils par pseudo (pour démarrer une conversation). */
export async function searchProfiles(query: string): Promise<DbProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .ilike("username", `%${query}%`)
    .limit(8);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbProfile[];
}
