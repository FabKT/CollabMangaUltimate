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
  /** Rôle principal choisi dans le popup de modification du profil (Dessinateur, Scénariste, Créateur de contenu, Lecteur). */
  role?: string | null;
};

export type DbIllustration = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  image_url: string;
  image_urls: string[];
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
  remuneration: boolean;
  engagement: "Long terme" | "Ponctuel";
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
  image_urls: string[];
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

const PROFILE_COLS = "id, username, display_name, avatar_url, role";

/** Utilisateur connecté (ou null). */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Persiste le rôle principal (et secondaire) choisi dans le popup de modification du profil. */
export async function updateMyRole(role: string, secondaryRole?: string | null): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour modifier ton profil.");
  const patch: { role: string; secondary_role?: string | null } = { role };
  if (secondaryRole !== undefined) patch.secondary_role = secondaryRole;
  const { error } = await sb.from("profiles").update(patch).eq("id", uid);
  if (error) throw new Error(error.message);
}

/** Rôles (principal + secondaire) de l'utilisateur courant. */
export async function getMyRoles(): Promise<{ role: string | null; secondaryRole: string | null }> {
  if (!supabase) return { role: null, secondaryRole: null };
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  if (!uid) return { role: null, secondaryRole: null };
  const { data } = await supabase
    .from("profiles")
    .select("role, secondary_role")
    .eq("id", uid)
    .single();
  return { role: data?.role ?? null, secondaryRole: data?.secondary_role ?? null };
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

export async function addIllustration(input: {
  title: string;
  description: string;
  file?: File;
  files?: File[];
}) {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour publier une illustration.");
  const files = input.files?.length ? input.files : input.file ? [input.file] : [];
  if (files.length === 0) throw new Error("Ajoute au moins une image.");
  const image_urls = await Promise.all(files.map((file) => uploadImage(file, "illustrations")));
  const image_url = image_urls[0];
  const { data, error } = await sb
    .from("illustrations")
    .insert({
      author_id: uid,
      title: input.title,
      description: input.description,
      image_url,
      image_urls,
    })
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
  remuneration?: boolean;
  engagement?: "Long terme" | "Ponctuel";
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

export async function addIdea(input: {
  title: string;
  category: string;
  description: string;
  file?: File | null;
  files?: File[];
}) {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour publier une proposition.");
  const files = input.files?.length ? input.files : input.file ? [input.file] : [];
  const image_urls = await Promise.all(files.map((file) => uploadImage(file, "ideas")));
  const image_url = image_urls[0] ?? null;
  const { data, error } = await sb
    .from("ideas")
    .insert({
      author_id: uid,
      title: input.title,
      category: input.category,
      description: input.description,
      image_url,
      image_urls,
    })
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

export async function sendMessage(
  conversationId: string,
  content: string,
  file?: File | null,
): Promise<DbMessage> {
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

  // Notification pour les autres membres de la conversation (best-effort :
  // l'envoi du message n'échoue jamais à cause d'une notification).
  try {
    const { data: members } = await sb
      .from("conversation_members")
      .select("profile_id")
      .eq("conversation_id", conversationId)
      .neq("profile_id", uid);
    const { data: me } = await sb
      .from("profiles")
      .select("display_name, username")
      .eq("id", uid)
      .single();
    const senderName = me?.display_name || me?.username || "Un membre";
    if (members?.length) {
      await sb.from("notifications").insert(
        members.map((m) => ({
          recipient_id: m.profile_id,
          actor_id: uid,
          category: "message",
          type: "nouveau_message",
          title: `${senderName} t'a envoyé un message`,
          content: (content || "Image envoyée").slice(0, 180),
          entity_type: "conversation",
          entity_title: senderName,
        })),
      );
    }
  } catch {
    /* silencieux */
  }
  return data as DbMessage;
}

/** Abonnement Realtime aux nouveaux messages d'une conversation. Retourne un unsubscribe. */
export function subscribeMessages(
  conversationId: string,
  onInsert: (m: DbMessage) => void,
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(payload.new as DbMessage),
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}

/* ---------------- amis (workflow_records + notifications) ---------------- */

export type DbFriendRequest = {
  id: string;
  status: string;
  initiator_id: string;
  recipient_id: string | null;
  created_at: string;
  initiator: DbProfile | null;
  recipient: DbProfile | null;
};

export async function sendProjectInvitationDb(input: {
  projectId: string;
  recipient: string;
  role: string;
  message?: string;
}): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour inviter un collaborateur.");

  const { data: matches, error: resolveError } = await sb.rpc(
    "resolve_profile_for_project_invitation",
    { identifier: input.recipient.trim() },
  );
  if (resolveError) throw new Error(resolveError.message);
  const recipient = (matches?.[0] ?? null) as DbProfile | null;
  if (!recipient) throw new Error("Aucun compte ne correspond à ce pseudo ou cet e-mail.");
  if (recipient.id === uid) throw new Error("Tu fais déjà partie de ce projet.");

  const { data: project, error: projectError } = await sb
    .from("studio_projects")
    .select("id, title, owner_id")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw new Error(projectError.message);
  if (project.owner_id !== uid) throw new Error("Seul le propriétaire peut envoyer cette invitation.");

  const { data: existing } = await sb
    .from("studio_project_members")
    .select("status")
    .eq("project_id", input.projectId)
    .eq("user_id", recipient.id)
    .maybeSingle();
  if (existing?.status === "active") throw new Error("Cette personne fait déjà partie du projet.");
  if (existing?.status === "invited") throw new Error("Une invitation est déjà en attente.");

  const { error: memberError } = await sb.from("studio_project_members").upsert(
    {
      project_id: input.projectId,
      user_id: recipient.id,
      access_level: "collaborateur",
      role: input.role,
      status: "invited",
      invited_by: uid,
    },
    { onConflict: "project_id,user_id" },
  );
  if (memberError) throw new Error(memberError.message);

  const { data: me } = await sb
    .from("profiles")
    .select("display_name, username")
    .eq("id", uid)
    .single();
  const senderName = me?.display_name || me?.username || "Un membre";
  const { data: record, error: recordError } = await sb
    .from("workflow_records")
    .insert({
      kind: "collaboration_invitation",
      status: "pending",
      initiator_id: uid,
      recipient_id: recipient.id,
      title: `Invitation collaboration - ${project.title}`,
      entity_type: "project",
      entity_title: project.title,
      payload: { projectId: input.projectId, role: input.role, message: input.message || "" },
    })
    .select("id")
    .single();
  if (recordError) throw new Error(recordError.message);

  const { error: notificationError } = await sb.from("notifications").insert({
    record_id: record.id,
    recipient_id: recipient.id,
    actor_id: uid,
    category: "project",
    type: "invitation_collab",
    title: `${senderName} t'invite à collaborer sur ${project.title}`,
    content: input.message || "Invitation à rejoindre un projet manga.",
    entity_type: "project",
    entity_title: project.title,
    entity_subtitle: `Rôle proposé : ${input.role}`,
    entity_status: "En attente",
    actions: [
      { label: "Accepter", kind: "primary" },
      { label: "Refuser", kind: "danger" },
    ],
    secondary_actions: [{ label: "Voir le projet", kind: "secondary" }],
    meta: [{ label: "Rôle proposé", value: input.role }],
  });
  if (notificationError) throw new Error(notificationError.message);
}

export async function respondProjectInvitationDb(recordId: string, accept: boolean): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour répondre à l'invitation.");
  const { data: record, error } = await sb
    .from("workflow_records")
    .select("initiator_id, recipient_id, payload, entity_title")
    .eq("id", recordId)
    .eq("kind", "collaboration_invitation")
    .eq("recipient_id", uid)
    .single();
  if (error) throw new Error(error.message);
  const projectId = (record.payload as { projectId?: unknown } | null)?.projectId;
  if (typeof projectId !== "string") throw new Error("Cette invitation ne contient aucun projet valide.");

  const { error: memberError } = await sb
    .from("studio_project_members")
    .update({ status: accept ? "active" : "declined" })
    .eq("project_id", projectId)
    .eq("user_id", uid);
  if (memberError) throw new Error(memberError.message);
  const { error: workflowError } = await sb
    .from("workflow_records")
    .update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", recordId);
  if (workflowError) throw new Error(workflowError.message);

  const { data: me } = await sb
    .from("profiles")
    .select("display_name, username")
    .eq("id", uid)
    .single();
  const memberName = me?.display_name || me?.username || "Un membre";
  await sb.from("notifications").insert({
    record_id: recordId,
    recipient_id: record.initiator_id,
    actor_id: uid,
    category: "project",
    type: accept ? "invitation_collab_acceptee" : "invitation_collab_refusee",
    title: accept
      ? `${memberName} a rejoint ${record.entity_title}`
      : `${memberName} a refusé l'invitation à ${record.entity_title}`,
    content: accept ? "Le collaborateur a maintenant accès au projet." : "",
    entity_type: "project",
    entity_title: record.entity_title,
  });
}

/** Envoie une vraie demande d'ami (record + notification au destinataire). */
export async function sendFriendRequestDb(recipientId: string): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour envoyer une demande d'ami.");
  if (uid === recipientId) throw new Error("Tu ne peux pas t'ajouter toi-même.");
  const { data: existing, error: existingError } = await sb
    .from("workflow_records")
    .select("status, initiator_id, recipient_id")
    .eq("kind", "friend_request")
    .or(`initiator_id.eq.${uid},recipient_id.eq.${uid}`);
  if (existingError) throw new Error(existingError.message);
  const relationship = (existing ?? []).find(
    (record) =>
      (record.initiator_id === uid && record.recipient_id === recipientId) ||
      (record.initiator_id === recipientId && record.recipient_id === uid),
  );
  if (relationship?.status === "accepted") throw new Error("Vous êtes déjà amis.");
  if (relationship?.status === "pending") throw new Error("Une demande d'ami est déjà en attente.");
  const { data: me } = await sb
    .from("profiles")
    .select("display_name, username")
    .eq("id", uid)
    .single();
  const senderName = me?.display_name || me?.username || "Un membre";
  const { data: record, error } = await sb
    .from("workflow_records")
    .insert({
      kind: "friend_request",
      status: "pending",
      initiator_id: uid,
      recipient_id: recipientId,
      title: `Demande d'ami de ${senderName}`,
      entity_type: "Amis",
      entity_title: senderName,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await sb.from("notifications").insert({
    record_id: record.id,
    recipient_id: recipientId,
    actor_id: uid,
    category: "friend",
    type: "demande_ami",
    title: `${senderName} t'a envoyé une demande d'ami`,
    content: "Accepte ou refuse la demande depuis ton profil, onglet Amis.",
    entity_type: "friend_request",
    entity_title: senderName,
  });
}

export type ProfileWorkflowDbInput = {
  kind: "collaboration_invitation" | "patronage_request" | "subscription";
  status: "pending" | "active";
  category: "project" | "sponsorship" | "friend";
  type: string;
  title: string;
  content: string;
  entityType: string;
  entityTitle: string;
};

/** Enregistre une action de profil et notifie réellement le compte visé. */
export async function sendProfileWorkflowDb(
  recipientId: string,
  input: ProfileWorkflowDbInput,
): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour effectuer cette action.");
  if (uid === recipientId)
    throw new Error("Cette action n'est pas disponible sur ton propre profil.");

  if (input.kind === "subscription") {
    const { data: existingSubscription, error: existingSubscriptionError } = await sb
      .from("workflow_records")
      .select("id")
      .eq("kind", "subscription")
      .eq("status", "active")
      .eq("initiator_id", uid)
      .eq("recipient_id", recipientId)
      .limit(1)
      .maybeSingle();
    if (existingSubscriptionError) throw new Error(existingSubscriptionError.message);
    if (existingSubscription) throw new Error("Tu suis déjà ce profil.");
  }

  const { data: me } = await sb
    .from("profiles")
    .select("display_name, username")
    .eq("id", uid)
    .single();
  const senderName = me?.display_name || me?.username || "Un membre";
  const { data: record, error } = await sb
    .from("workflow_records")
    .insert({
      kind: input.kind,
      status: input.status,
      initiator_id: uid,
      recipient_id: recipientId,
      title: input.title,
      entity_type: input.entityType,
      entity_title: input.entityTitle,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: notificationError } = await sb.from("notifications").insert({
    record_id: record.id,
    recipient_id: recipientId,
    actor_id: uid,
    category: input.category,
    type: input.type,
    title: `${senderName} — ${input.title}`,
    content: input.content,
    entity_type: input.entityType,
    entity_title: input.entityTitle || senderName,
  });
  if (notificationError) throw new Error(notificationError.message);
}

/** Demandes d'ami en attente reçues par l'utilisateur connecté. */
export async function listPendingFriendRequests(): Promise<DbFriendRequest[]> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return [];
  const { data, error } = await sb
    .from("workflow_records")
    .select(
      `id, status, initiator_id, recipient_id, created_at, initiator:profiles!workflow_records_initiator_id_fkey(${PROFILE_COLS}), recipient:profiles!workflow_records_recipient_id_fkey(${PROFILE_COLS})`,
    )
    .eq("kind", "friend_request")
    .eq("status", "pending")
    .eq("recipient_id", uid);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbFriendRequest[];
}

/** Accepte ou refuse une demande d'ami, et notifie l'initiateur. */
export async function respondFriendRequestDb(recordId: string, accept: boolean): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi.");
  const { data: record, error } = await sb
    .from("workflow_records")
    .update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", recordId)
    .select("initiator_id")
    .single();
  if (error) throw new Error(error.message);
  const { data: me } = await sb
    .from("profiles")
    .select("display_name, username")
    .eq("id", uid)
    .single();
  const myName = me?.display_name || me?.username || "Un membre";
  await sb.from("notifications").insert({
    record_id: recordId,
    recipient_id: record.initiator_id,
    actor_id: uid,
    category: "friend",
    type: accept ? "ami_accepte" : "ami_refuse",
    title: accept ? `${myName} a accepté ta demande d'ami` : `${myName} a refusé ta demande d'ami`,
    content: accept ? "Vous êtes maintenant amis." : "",
    entity_type: "friend_request",
    entity_title: myName,
  });
}

/** Liste des amis (demandes acceptées, dans les deux sens). */
export async function listFriendsDb(): Promise<DbProfile[]> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return [];
  const { data, error } = await sb
    .from("workflow_records")
    .select(
      `initiator_id, recipient_id, initiator:profiles!workflow_records_initiator_id_fkey(${PROFILE_COLS}), recipient:profiles!workflow_records_recipient_id_fkey(${PROFILE_COLS})`,
    )
    .eq("kind", "friend_request")
    .eq("status", "accepted")
    .or(`initiator_id.eq.${uid},recipient_id.eq.${uid}`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as DbFriendRequest[];
  return rows
    .map((r) => (r.initiator_id === uid ? r.recipient : r.initiator))
    .filter((p): p is DbProfile => Boolean(p));
}

/* ---------------- notifications (table Supabase) ---------------- */

export type DbNotification = {
  id: string;
  record_id: string | null;
  recipient_id: string;
  actor_id: string | null;
  category: string;
  type: string;
  title: string;
  content: string;
  entity_type: string | null;
  entity_title: string | null;
  entity_subtitle: string | null;
  entity_status: string | null;
  actions: { label: string; kind: string }[] | null;
  secondary_actions: { label: string; kind: string }[] | null;
  meta: { label: string; value: string }[] | null;
  read: boolean;
  created_at: string;
};

/** Notifications reçues par l'utilisateur connecté (amis, messages…). */
export async function listMyNotifications(): Promise<DbNotification[]> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return [];
  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_id", uid)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbNotification[];
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("notifications").update({ read }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return;
  const { error } = await sb.from("notifications").update({ read: true }).eq("recipient_id", uid);
  if (error) throw new Error(error.message);
}

export async function clearReadNotifications(): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return;
  const { error } = await sb
    .from("notifications")
    .delete()
    .eq("recipient_id", uid)
    .eq("read", true);
  if (error) throw new Error(error.message);
}

/* ---------------- commentaires ---------------- */

export type DbComment = {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: DbProfile | null;
};

export type CommentEntityType =
  "illustration" | "idea" | "announcement" | "manga_chapter" | "sponsor_option";

export async function listComments(
  entityType: CommentEntityType,
  entityId: string,
): Promise<DbComment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("comments")
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbComment[];
}

export async function addComment(
  entityType: CommentEntityType,
  entityId: string,
  content: string,
): Promise<DbComment> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour commenter.");
  const { data, error } = await sb
    .from("comments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: uid,
      content: content.trim(),
    })
    .select(`*, author:profiles(${PROFILE_COLS})`)
    .single();
  if (error) throw new Error(error.message);
  return data as DbComment;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Profil public résolu par UUID (page Discover) OU par pseudo (liens divers). */
export async function getProfileByUsername(
  slugOrId: string,
): Promise<(DbProfile & { role?: string | null; secondary_role?: string | null }) | null> {
  if (!supabase) return null;
  const cols = "id, username, display_name, avatar_url, role, secondary_role";
  const clean = slugOrId.replace(/^@/, "");
  if (UUID_RE.test(clean)) {
    const { data } = await supabase.from("profiles").select(cols).eq("id", clean).maybeSingle();
    if (data) return data as DbProfile & { role?: string | null; secondary_role?: string | null };
  }
  const { data } = await supabase
    .from("profiles")
    .select(cols)
    .ilike("username", clean)
    .limit(1)
    .maybeSingle();
  return (
    (data as (DbProfile & { role?: string | null; secondary_role?: string | null }) | null) ?? null
  );
}

/** Liste des profils inscrits (page Discover). */
export async function listProfiles(limit = 60): Promise<DbProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .order("username", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbProfile[];
}

/** Recherche de profils par pseudo (pour démarrer une conversation). */
export async function searchProfiles(query: string): Promise<DbProfile[]> {
  if (!supabase) return [];
  const clean = query.replace(/[,%()]/g, " ").trim();
  if (!clean) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
    .limit(8);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbProfile[];
}
