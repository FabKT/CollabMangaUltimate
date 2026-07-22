import { getSupabase } from "@/lib/supabase";

export type WorkflowCategory = "project" | "sponsorship" | "friend" | "manga" | "system";

export type WorkflowRecordKind =
  | "collaboration_invitation"
  | "collaboration_removed"
  | "collaboration_role_updated"
  | "proposal"
  | "proposal_response"
  | "subscription"
  | "friend_request"
  | "friend_response"
  | "patronage_request"
  | "patronage_response"
  | "announcement"
  | "announcement_sponsoring"
  | "sponsorship_contact"
  | "project_note"
  | "project_note_update"
  | "project_created";

export type WorkflowStatus = "pending" | "accepted" | "declined" | "active" | "sent" | "created" | "removed" | "updated";

export type WorkflowActionKind = "primary" | "secondary" | "ghost" | "danger";

export type WorkflowNotificationAction = {
  label: string;
  kind: WorkflowActionKind;
};

export type WorkflowNotification = {
  id: string;
  recordId: string;
  category: WorkflowCategory;
  type: string;
  title: string;
  content: string;
  recipient: string;
  actor: string;
  read: boolean;
  createdAt: string;
  entityType: string;
  entityTitle: string;
  entitySubtitle?: string;
  entityStatus?: string;
  actions: WorkflowNotificationAction[];
  secondaryActions?: WorkflowNotificationAction[];
  meta?: Array<{ label: string; value: string }>;
};

export type WorkflowRecord = {
  id: string;
  kind: WorkflowRecordKind;
  status: WorkflowStatus;
  createdAt: string;
  initiator: string;
  recipient?: string;
  title: string;
  entityType: string;
  entityTitle: string;
  payload: Record<string, unknown>;
};

export type WorkflowState = {
  records: WorkflowRecord[];
  notifications: WorkflowNotification[];
};

type CreateRecordInput = Omit<WorkflowRecord, "id" | "createdAt"> & {
  notification?: Omit<WorkflowNotification, "id" | "recordId" | "createdAt" | "read">;
};

const CURRENT_USER = "Current user";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nowIso = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function emptyState(): WorkflowState {
  return { records: [], notifications: [] };
}

function readState(): WorkflowState {
  return emptyState();
}

export function loadWorkflowState(): WorkflowState {
  return readState();
}

export function subscribeWorkflowState(listener: () => void) {
  void listener;
  return () => {};
}

async function persistWorkflowRecord(input: CreateRecordInput) {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return;
  let recipientId: string | null = null;
  if (input.recipient && input.recipient !== CURRENT_USER) {
    if (UUID_RE.test(input.recipient)) {
      recipientId = input.recipient;
    } else {
      const { data } = await sb.rpc("resolve_profile_for_project_invitation", {
        identifier: input.recipient,
      });
      recipientId = data?.[0]?.id ?? null;
    }
  }
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
      payload: input.payload,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!input.notification || !recipientId || recipientId === uid) return;
  const notification = input.notification;
  const { error: notificationError } = await sb.from("notifications").insert({
    record_id: record.id,
    recipient_id: recipientId,
    actor_id: uid,
    category: notification.category,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    entity_type: notification.entityType,
    entity_title: notification.entityTitle,
    entity_subtitle: notification.entitySubtitle,
    entity_status: notification.entityStatus,
    actions: notification.actions,
    secondary_actions: notification.secondaryActions,
    meta: notification.meta,
  });
  if (notificationError) throw new Error(notificationError.message);
}

export function createWorkflowRecord(input: CreateRecordInput): WorkflowRecord {
  const record: WorkflowRecord = {
    id: newId("wf"),
    createdAt: nowIso(),
    kind: input.kind,
    status: input.status,
    initiator: input.initiator,
    recipient: input.recipient,
    title: input.title,
    entityType: input.entityType,
    entityTitle: input.entityTitle,
    payload: input.payload,
  };
  void persistWorkflowRecord(input).catch(() => {});
  return record;
}

export function setWorkflowNotificationRead(id: string, read = true) {
  void id;
  void read;
}

export function markAllWorkflowNotificationsRead() {
  return;
}

export function sendCollaborationInvitation(input: {
  recipient: string;
  projectTitle: string;
  role?: string;
  message?: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "collaboration_invitation",
    status: "pending",
    initiator: actor,
    recipient: input.recipient,
    title: `Invitation collaboration - ${input.projectTitle}`,
    entityType: "Propositions",
    entityTitle: input.projectTitle,
    payload: input,
    notification: {
      category: "project",
      type: "invitation_collab",
      title: `${actor} t'invite à collaborer sur ${input.projectTitle}`,
      content: input.message || "Invitation à rejoindre un projet manga.",
      recipient: input.recipient,
      actor,
      entityType: "project",
      entityTitle: input.projectTitle,
      entitySubtitle: input.role ? `Rôle proposé : ${input.role}` : "Invitation projet",
      entityStatus: "En attente",
      actions: [
        { label: "Accepter", kind: "primary" },
        { label: "Refuser", kind: "danger" },
      ],
      secondaryActions: [{ label: "Voir le projet", kind: "secondary" }],
      meta: [
        { label: "Rôle proposé", value: input.role || "Non renseigné" },
        { label: "Projet", value: input.projectTitle },
      ],
    },
  });
}

export function updateCollaboratorRole(input: {
  collaborator: string;
  projectTitle: string;
  role: string;
  initiator?: string;
}) {
  return createWorkflowRecord({
    kind: "collaboration_role_updated",
    status: "updated",
    initiator: input.initiator ?? CURRENT_USER,
    recipient: input.collaborator,
    title: `Rôle collaborateur modifié - ${input.projectTitle}`,
    entityType: "Projet",
    entityTitle: input.projectTitle,
    payload: input,
  });
}

export function removeCollaborator(input: {
  collaborator: string;
  projectTitle: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "collaboration_removed",
    status: "removed",
    initiator: actor,
    recipient: input.collaborator,
    title: `Retrait collaborateur - ${input.projectTitle}`,
    entityType: "Projet",
    entityTitle: input.projectTitle,
    payload: input,
    notification: {
      category: "project",
      type: "retrait_collab",
      title: `Tu as été retiré du projet ${input.projectTitle}`,
      content: "Cette notification est informative et ne demande aucune action.",
      recipient: input.collaborator,
      actor,
      entityType: "project",
      entityTitle: input.projectTitle,
      entityStatus: "Retiré",
      actions: [{ label: "Voir le projet", kind: "secondary" }],
    },
  });
}

export function sendProposal(input: {
  title: string;
  description: string;
  skills: string[];
  projectTitle?: string;
  recipient?: string;
  deadline?: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "proposal",
    status: "pending",
    initiator: actor,
    recipient: input.recipient,
    title: input.title,
    entityType: "Propositions",
    entityTitle: input.projectTitle || input.title,
    payload: input,
    notification: undefined,
    /*
    input.recipient
      ? {
          category: "project",
          type: "proposition",
          title: `${actor} t'a envoyé une proposition de collaboration`,
          content: input.description,
          recipient: input.recipient,
          actor,
          entityType: "proposal",
          entityTitle: input.title,
          entitySubtitle: input.projectTitle,
          entityStatus: "En attente",
          actions: [
            { label: "Accepter", kind: "primary" },
            { label: "Refuser", kind: "danger" },
            { label: "Voir la proposition", kind: "secondary" },
          ],
          meta: [
            { label: "Compétences", value: input.skills.join(", ") },
            { label: "Projet associé", value: input.projectTitle || "Aucun" },
          ],
        }
      : undefined,
    */
  });
}

export function respondToProposal(input: {
  proposalTitle: string;
  accepted: boolean;
  message?: string;
  recipient: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "proposal_response",
    status: input.accepted ? "accepted" : "declined",
    initiator: actor,
    recipient: input.recipient,
    title: `Réponse proposition - ${input.proposalTitle}`,
    entityType: "Réponses",
    entityTitle: input.proposalTitle,
    payload: input,
    notification: undefined,
    /*
    {
      category: "project",
      type: "reponse_proposition",
      title: `${actor} a ${input.accepted ? "accepté" : "refusé"} ta proposition de collaboration`,
      content: input.message || "Réponse envoyée depuis une annonce.",
      recipient: input.recipient,
      actor,
      entityType: "proposal_response",
      entityTitle: input.proposalTitle,
      entityStatus: input.accepted ? "Acceptée" : "Refusée",
      actions: [{ label: "Voir le profil", kind: "secondary" }],
      meta: [{ label: "Décision", value: input.accepted ? "Acceptée" : "Refusée" }],
    },
    */
  });
}

export function followCreator(input: { creatorName: string; initiator?: string }) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "subscription",
    status: "active",
    initiator: actor,
    recipient: input.creatorName,
    title: `Abonnement - ${input.creatorName}`,
    entityType: "Abonnés",
    entityTitle: input.creatorName,
    payload: input,
    notification: {
      category: "friend",
      type: "abonnement",
      title: `${actor} s'est abonné à toi`,
      content: "Un nouveau lecteur suit ton activité.",
      recipient: input.creatorName,
      actor,
      entityType: "profile",
      entityTitle: input.creatorName,
      entityStatus: "Nouvel abonné",
      actions: [
        { label: "Voir le profil", kind: "secondary" },
        { label: "S'abonner en retour", kind: "ghost" },
      ],
    },
  });
}

export function sendFriendRequest(input: { recipient: string; initiator?: string }) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "friend_request",
    status: "pending",
    initiator: actor,
    recipient: input.recipient,
    title: `Demande d'ami - ${input.recipient}`,
    entityType: "Friends",
    entityTitle: input.recipient,
    payload: input,
    notification: {
      category: "friend",
      type: "demande_ami",
      title: `${actor} souhaite devenir ton ami`,
      content: "Demande d'amitié en attente de réponse.",
      recipient: input.recipient,
      actor,
      entityType: "profile",
      entityTitle: actor,
      entityStatus: "En attente",
      actions: [
        { label: "Accepter", kind: "primary" },
        { label: "Refuser", kind: "danger" },
      ],
    },
  });
}

export function respondToFriendRequest(input: {
  requester: string;
  accepted: boolean;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "friend_response",
    status: input.accepted ? "accepted" : "declined",
    initiator: actor,
    recipient: input.accepted ? input.requester : undefined,
    title: `Réponse amitié - ${input.requester}`,
    entityType: "Friends",
    entityTitle: input.requester,
    payload: input,
    notification: input.accepted
      ? {
          category: "friend",
          type: "ami_accepte",
          title: `${actor} a accepté ta demande d'amitié`,
          content: "Vous êtes maintenant amis sur CollabManga.",
          recipient: input.requester,
          actor,
          entityType: "profile",
          entityTitle: actor,
          entityStatus: "Ami accepté",
          actions: [{ label: "Voir le profil", kind: "secondary" }],
        }
      : undefined,
  });
}

export function sendPatronageRequest(input: {
  recipient: string;
  level: string;
  message?: string;
  startDate?: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "patronage_request",
    status: "pending",
    initiator: actor,
    recipient: input.recipient,
    title: `Parrainage - ${input.recipient}`,
    entityType: "Parrainage-Collaboration",
    entityTitle: input.level,
    payload: input,
    notification: {
      category: "sponsorship",
      type: "parrainage",
      title: `${actor} souhaite te parrainer - ${input.level}`,
      content: input.message || "Demande de parrainage en attente.",
      recipient: input.recipient,
      actor,
      entityType: "patronage",
      entityTitle: input.level,
      entityStatus: "En attente",
      actions: [
        { label: "Accepter le parrainage", kind: "primary" },
        { label: "Refuser", kind: "danger" },
      ],
      meta: [
        { label: "Niveau", value: input.level },
        { label: "Début souhaité", value: input.startDate || "Non renseigné" },
      ],
    },
  });
}

export function sendAnnouncementSponsoring(input: {
  announcementTitle: string;
  owner: string;
  duration: string;
  level: string;
  message?: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  return createWorkflowRecord({
    kind: "announcement_sponsoring",
    status: "pending",
    initiator: actor,
    recipient: input.owner,
    title: `Sponsoring annonce - ${input.announcementTitle}`,
    entityType: "Sponso_annonce",
    entityTitle: input.announcementTitle,
    payload: input,
    notification: {
      category: "sponsorship",
      type: "sponsoring",
      title: `${actor} souhaite sponsoriser ton annonce : ${input.announcementTitle}`,
      content: input.message || "Demande de sponsoring d'annonce.",
      recipient: input.owner,
      actor,
      entityType: "announcement",
      entityTitle: input.announcementTitle,
      entityStatus: "En attente de confirmation",
      actions: [
        { label: "Accepter", kind: "primary" },
        { label: "Refuser", kind: "danger" },
        { label: "Voir l'annonce", kind: "secondary" },
      ],
      meta: [
        { label: "Niveau", value: input.level },
        { label: "Durée", value: input.duration },
      ],
    },
  });
}

export function sendSponsorshipContact(input: {
  announcementTitle: string;
  announcementMode: "creator" | "project";
  owner: string;
  linked: string;
  budgetOrPrice: string;
  sponsorshipType: string;
  message: string;
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  const isProjectAnnouncement = input.announcementMode === "project";
  return createWorkflowRecord({
    kind: "sponsorship_contact",
    status: "pending",
    initiator: actor,
    recipient: input.owner,
    title: `${isProjectAnnouncement ? "Candidature parrainage" : "Contact parrainage"} - ${input.announcementTitle}`,
    entityType: "Parrainage",
    entityTitle: input.announcementTitle,
    payload: input,
    notification: {
      category: "sponsorship",
      type: isProjectAnnouncement ? "candidature_parrainage" : "contact_parrainage",
      title: isProjectAnnouncement
        ? `${actor} souhaite promouvoir ton projet : ${input.announcementTitle}`
        : `${actor} veut contacter ton offre de parrainage : ${input.announcementTitle}`,
      content: input.message || "Nouveau contact depuis une annonce de parrainage.",
      recipient: input.owner,
      actor,
      entityType: "sponsorship",
      entityTitle: input.announcementTitle,
      entitySubtitle: input.linked,
      entityStatus: "En attente de réponse",
      actions: [
        { label: "Accepter", kind: "primary" },
        { label: "Refuser", kind: "danger" },
        { label: "Ouvrir la discussion parrainage", kind: "secondary" },
      ],
      secondaryActions: [{ label: "Voir le profil", kind: "ghost" }],
      meta: [
        { label: isProjectAnnouncement ? "Budget" : "Prix", value: input.budgetOrPrice || "A définir" },
        { label: "Type", value: input.sponsorshipType },
        { label: isProjectAnnouncement ? "Projet" : "Profil lié", value: input.linked },
      ],
    },
  });
}

export function createAnnouncementWorkflow(input: {
  title: string;
  category: string;
  description: string;
  projectTitle?: string;
  initiator?: string;
}) {
  return createWorkflowRecord({
    kind: "announcement",
    status: "created",
    initiator: input.initiator ?? CURRENT_USER,
    title: input.title,
    entityType: "Annonces",
    entityTitle: input.projectTitle || input.title,
    payload: input,
  });
}

export function createProjectNote(input: {
  projectTitle: string;
  content: string;
  collaborators?: string[];
  initiator?: string;
}) {
  const actor = input.initiator ?? CURRENT_USER;
  const recipient = input.collaborators?.find((name) => name !== actor);
  return createWorkflowRecord({
    kind: "project_note",
    status: "created",
    initiator: actor,
    recipient,
    title: `Note projet - ${input.projectTitle}`,
    entityType: "Notes",
    entityTitle: input.projectTitle,
    payload: input,
    notification: recipient
      ? {
          category: "project",
          type: "note_projet",
          title: `${actor} a ajouté une note sur ${input.projectTitle}`,
          content: input.content.slice(0, 180),
          recipient,
          actor,
          entityType: "note",
          entityTitle: input.projectTitle,
          entityStatus: "Nouvelle note",
          actions: [{ label: "Voir la note", kind: "secondary" }],
        }
      : undefined,
  });
}

export function updateProjectNote(input: { projectTitle: string; content: string; initiator?: string }) {
  return createWorkflowRecord({
    kind: "project_note_update",
    status: "updated",
    initiator: input.initiator ?? CURRENT_USER,
    title: `Note projet modifiée - ${input.projectTitle}`,
    entityType: "Notes",
    entityTitle: input.projectTitle,
    payload: input,
  });
}

export function createProjectWorkflow(input: {
  title: string;
  synopsis: string;
  genres: string[];
  initiator?: string;
}) {
  return createWorkflowRecord({
    kind: "project_created",
    status: "created",
    initiator: input.initiator ?? CURRENT_USER,
    title: input.title,
    entityType: "Projets",
    entityTitle: input.title,
    payload: input,
  });
}

/** Vide entièrement le store local (records + notifications). */
export function clearWorkflowState() {
  return;
}

/**
 * DÉMO — génère un exemplaire de CHAQUE type de notification que le système
 * peut produire (12 types), adressé à l'utilisateur courant, pour valider le
 * rendu de la page Notifications. Repart d'un store vide.
 */
export function seedDemoWorkflowNotifications() {
  clearWorkflowState();

  // 1. invitation_collab — invitation à collaborer sur un projet
  sendCollaborationInvitation({
    recipient: CURRENT_USER,
    projectTitle: "Neon Ronin",
    role: "Dessinateur",
    message: "Ton style colle parfaitement à notre univers cyberpunk, rejoins l'équipe pour l'arc 2 !",
    initiator: "Aiko Tanaka",
  });

  // 2. retrait_collab — retiré d'un projet
  removeCollaborator({
    collaborator: CURRENT_USER,
    projectTitle: "Hollow Sky",
    initiator: "Ren Sato",
  });

  // 3. proposition — proposition de collaboration reçue
  sendProposal({
    title: "Refonte du chara-design du protagoniste",
    description: "Je te propose une passe complète sur le design du héros : silhouette, expressions et tenue alternative.",
    skills: ["Character design", "Encrage"],
    projectTitle: "Ashen Verdict",
    recipient: CURRENT_USER,
    deadline: "2026-08-01",
    initiator: "Mika Ito",
  });

  // 4. reponse_proposition — réponse à ta proposition
  respondToProposal({
    proposalTitle: "Pages d'action chapitre 5",
    accepted: true,
    message: "Ta proposition est exactement ce qu'on cherchait, on démarre lundi.",
    recipient: CURRENT_USER,
    initiator: "Hana Kimura",
  });

  // 5. abonnement — nouvel abonné
  followCreator({ creatorName: CURRENT_USER, initiator: "Yui Nakamura" });

  // 6. demande_ami
  sendFriendRequest({ recipient: CURRENT_USER, initiator: "Kenji Watanabe" });

  // 7. ami_accepte — demande d'ami acceptée
  respondToFriendRequest({ requester: CURRENT_USER, accepted: true, initiator: "Sora Fujimoto" });

  // 8. parrainage — demande de parrainage
  sendPatronageRequest({
    recipient: CURRENT_USER,
    level: "Vidéo longue dédiée",
    message: "Je veux mettre en avant ton manga sur ma chaîne, 4 vidéos sur le mois.",
    startDate: "2026-08-15",
    initiator: "@panelpulse",
  });

  // 9. sponsoring — sponsoring d'une de tes annonces
  sendAnnouncementSponsoring({
    announcementTitle: "Recherche coloriste — Kurogane Requiem",
    owner: CURRENT_USER,
    duration: "6 semaines",
    level: "Post communautaire",
    message: "Je sponsorise ton annonce pour lui donner plus de visibilité auprès de ma communauté.",
    initiator: "Orion Ink",
  });

  // 10. candidature_parrainage — un créateur candidate à ton annonce projet
  sendSponsorshipContact({
    announcementTitle: "Lancement shonen — Neon Ronin",
    announcementMode: "project",
    owner: CURRENT_USER,
    linked: "Neon Ronin",
    budgetOrPrice: "300–800 €",
    sponsorshipType: "Vidéo longue dédiée",
    message: "Ma chaîne (48k abonnés) est spécialisée shonen, je propose une présentation complète du projet.",
    initiator: "@midori_talks",
  });

  // 11. contact_parrainage — un porteur de projet contacte ton offre créateur
  sendSponsorshipContact({
    announcementTitle: "Review dédiée sur ma chaîne",
    announcementMode: "creator",
    owner: CURRENT_USER,
    linked: "@toi",
    budgetOrPrice: "260 €",
    sponsorshipType: "Review",
    message: "Notre seinen sort son tome 2, ta review serait parfaite pour le lancement.",
    initiator: "Studio Kuro",
  });

  // 12. note_projet — note ajoutée sur un projet partagé
  createProjectNote({
    projectTitle: "Neon Ronin",
    content: "J'ai déposé les références de décors pour les toits du chapitre 3 — regarde avant de commencer les planches.",
    collaborators: [CURRENT_USER, "Aiko Tanaka"],
    initiator: "Aiko Tanaka",
  });
}
