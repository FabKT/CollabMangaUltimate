import { getSupabase } from "@/lib/supabase";

type StudioProjectLike = Record<string, unknown> & {
  id: string;
  title?: string;
  synopsis?: string;
  status?: string;
  catalogVisible?: boolean;
};

type StudioProjectRow = {
  id: string;
  owner_id: string;
  data: Record<string, unknown>;
};

type StudioMemberRow = {
  project_id: string;
  user_id: string;
  access_level: "chef" | "editeur" | "collaborateur";
  role: string | null;
  status: string;
  profile: {
    username: string;
    display_name: string | null;
    role: string | null;
  } | null;
};

type PublicProjectRow = StudioProjectRow & { title: string };

type PublicProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  role: string | null;
};

const LEGACY_DB_NAME = "collabmanga-studio";
const LEGACY_DB_VERSION = 1;
const LEGACY_STORE = "projects";
const LEGACY_RECORD_ID = "all";
const LEGACY_MIGRATION_OWNER_KEY = "collabmanga.studio.supabaseMigrationOwner.v1";

const lastSavedPayload = new Map<string, string>();
const uploadedDataUrls = new Map<string, string>();
let saveQueue: Promise<boolean> = Promise.resolve(true);

function isProject(value: unknown): value is StudioProjectLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { id?: unknown }).id === "string",
  );
}

function openLegacyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE)) {
        db.createObjectStore(LEGACY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadLegacyProjects<T>(): Promise<T[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openLegacyDb();
    const record = await new Promise<{ projects?: unknown } | undefined>((resolve, reject) => {
      const tx = db.transaction(LEGACY_STORE, "readonly");
      const request = tx.objectStore(LEGACY_STORE).get(LEGACY_RECORD_ID);
      request.onsuccess = () => resolve(request.result as { projects?: unknown } | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return Array.isArray(record?.projects) ? (record.projects as T[]) : [];
  } catch {
    return [];
  }
}

function extensionForMime(mime: string) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

async function uploadDataUrl(dataUrl: string, userId: string, projectId: string) {
  const cached = uploadedDataUrls.get(dataUrl);
  if (cached) return cached;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
  const path = `${userId}/projects/${projectId}/${hash}.${extensionForMime(blob.type)}`;
  const sb = getSupabase();
  const { error } = await sb.storage.from("media").upload(path, blob, {
    contentType: blob.type || "image/png",
    upsert: true,
  });
  if (error) throw new Error(`L'image du projet n'a pas pu être sauvegardée : ${error.message}`);
  const publicUrl = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  uploadedDataUrls.set(dataUrl, publicUrl);
  return publicUrl;
}

async function persistEmbeddedImages(
  value: unknown,
  userId: string,
  projectId: string,
): Promise<unknown> {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? uploadDataUrl(value, userId, projectId) : value;
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => persistEmbeddedImages(item, userId, projectId)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [
        key,
        await persistEmbeddedImages(item, userId, projectId),
      ]),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

async function sessionUserId() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.user.id ?? null;
}

async function listRemoteRows(userId: string): Promise<StudioProjectRow[]> {
  const sb = getSupabase();
  const [ownedResult, membershipResult] = await Promise.all([
    sb.from("studio_projects").select("id, owner_id, data").eq("owner_id", userId),
    sb
      .from("studio_project_members")
      .select("project_id")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);
  if (ownedResult.error) throw new Error(ownedResult.error.message);
  if (membershipResult.error) throw new Error(membershipResult.error.message);

  const memberIds = (membershipResult.data ?? []).map((row) => row.project_id);
  const memberResult = memberIds.length
    ? await sb.from("studio_projects").select("id, owner_id, data").in("id", memberIds)
    : { data: [] as StudioProjectRow[], error: null };
  if (memberResult.error) throw new Error(memberResult.error.message);

  const rows = new Map<string, StudioProjectRow>();
  for (const row of [...(ownedResult.data ?? []), ...(memberResult.data ?? [])]) {
    rows.set(row.id, row as StudioProjectRow);
  }
  const projectIds = [...rows.keys()];
  if (projectIds.length === 0) return [];
  const { data: members, error: membersError } = await sb
    .from("studio_project_members")
    .select(
      "project_id, user_id, access_level, role, status, profile:profiles!studio_project_members_user_id_fkey(username, display_name, role)",
    )
    .in("project_id", projectIds)
    .eq("status", "active");
  if (membersError) throw new Error(membersError.message);

  return [...rows.values()].map((row) => {
    const collaborators = ((members ?? []) as unknown as StudioMemberRow[])
      .filter((member) => member.project_id === row.id)
      .map((member) => ({
        id: member.user_id,
        name:
          member.user_id === userId
            ? "Vous"
            : member.profile?.display_name || member.profile?.username || "Collaborateur",
        role: member.role || member.profile?.role || "Collaborateur",
        level: member.access_level,
        isCurrentUser: member.user_id === userId,
      }));
    if (row.owner_id === userId && !collaborators.some((member) => member.id === userId)) {
      collaborators.unshift({
        id: userId,
        name: "Vous",
        role: "Créateur",
        level: "chef",
        isCurrentUser: true,
      });
    }
    return {
      ...row,
      data: collaborators.length > 0 ? { ...row.data, collaborators } : row.data,
    };
  });
}

async function saveRemoteProjects(projects: StudioProjectLike[], userId: string): Promise<boolean> {
  const sb = getSupabase();
  const ids = projects.map((project) => project.id);
  const [existingResult, membershipResult] = await Promise.all([
    ids.length
    ? sb.from("studio_projects").select("id, owner_id").in("id", ids)
    : Promise.resolve({ data: [] as { id: string; owner_id: string }[], error: null }),
    ids.length
      ? sb
          .from("studio_project_members")
          .select("project_id, access_level")
          .eq("user_id", userId)
          .eq("status", "active")
          .in("project_id", ids)
      : Promise.resolve({ data: [] as Array<{ project_id: string; access_level: string }>, error: null }),
  ]);
  if (existingResult.error) throw new Error(existingResult.error.message);
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  const owners = new Map((existingResult.data ?? []).map((row) => [row.id, row.owner_id]));
  const accessLevels = new Map((membershipResult.data ?? []).map((row) => [row.project_id, row.access_level]));

  for (const project of projects) {
    // Collaborators are derived from membership rows and may contain the session label "Vous".
    const { collaborators: _collaborators, ...projectWithoutCollaborators } = project;
    const persisted = (await persistEmbeddedImages(
      projectWithoutCollaborators,
      userId,
      project.id,
    )) as StudioProjectLike;
    const payload = JSON.stringify(persisted);
    const cacheKey = `${userId}:${project.id}`;
    if (lastSavedPayload.get(cacheKey) === payload) continue;

    if (owners.get(project.id) !== userId && accessLevels.get(project.id) === "collaborateur") {
      const { error } = await sb.rpc("merge_studio_candidate_images", {
        target_project_id: project.id,
        incoming_data: persisted,
      });
      if (error) throw new Error(error.message);
      lastSavedPayload.set(cacheKey, payload);
      continue;
    }

    const ownerId = owners.get(project.id) ?? userId;
    const { error } = await sb.from("studio_projects").upsert(
      {
        id: project.id,
        owner_id: ownerId,
        title: persisted.title || "Projet sans titre",
        synopsis: persisted.synopsis || "",
        status: persisted.status || "Draft",
        catalog_visible: Boolean(persisted.catalogVisible),
        data: persisted,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    if (!owners.has(project.id)) {
      const { error: memberError } = await sb.from("studio_project_members").upsert(
        {
          project_id: project.id,
          user_id: userId,
          access_level: "chef",
          status: "active",
          invited_by: userId,
        },
        { onConflict: "project_id,user_id" },
      );
      if (memberError) throw new Error(memberError.message);
    }
    lastSavedPayload.set(cacheKey, payload);
  }
  return true;
}

/** Charge uniquement les projets appartenant au compte connecté ou auxquels il participe. */
export async function loadStudioProjects<T>(): Promise<T[]> {
  const userId = await sessionUserId();
  if (!userId) return [];

  let rows = await listRemoteRows(userId);
  if (
    rows.length === 0 &&
    typeof window !== "undefined" &&
    window.localStorage.getItem(LEGACY_MIGRATION_OWNER_KEY) === null
  ) {
    const legacy = (await loadLegacyProjects<unknown>()).filter(isProject);
    if (legacy.length > 0) {
      await saveRemoteProjects(legacy, userId);
      window.localStorage.setItem(LEGACY_MIGRATION_OWNER_KEY, userId);
      rows = await listRemoteRows(userId);
    }
  }

  return rows.map((row) => {
    lastSavedPayload.set(`${userId}:${row.id}`, JSON.stringify(row.data));
    return row.data as T;
  });
}

export function subscribeStudioProjects(onChange: () => void): () => void {
  const sb = getSupabase();
  const suffix = crypto.randomUUID();
  const projectsChannel = sb
    .channel(`studio-projects-${suffix}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "studio_projects" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "studio_project_members" }, onChange)
    .subscribe();
  return () => { void sb.removeChannel(projectsChannel); };
}

/** Charge les projets publiés pour le catalogue, y compris sans session. */
export async function loadPublicStudioProjects<T>(): Promise<T[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("studio_projects")
    .select("id, owner_id, title, data")
    .eq("catalog_visible", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PublicProjectRow[];
  if (rows.length === 0) return [];

  const projectIds = rows.map((row) => row.id);
  const ownerIds = [...new Set(rows.map((row) => row.owner_id))];
  const [membersResult, ownersResult] = await Promise.all([
    sb
      .from("studio_project_members")
      .select(
        "project_id, user_id, access_level, role, status, profile:profiles!studio_project_members_user_id_fkey(username, display_name, role)",
      )
      .in("project_id", projectIds)
      .eq("status", "active"),
    sb.from("profiles").select("id, username, display_name, role").in("id", ownerIds),
  ]);
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (ownersResult.error) throw new Error(ownersResult.error.message);

  const owners = new Map(
    ((ownersResult.data ?? []) as PublicProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const members = (membersResult.data ?? []) as unknown as StudioMemberRow[];

  return rows.map((row) => {
    const collaborators = members
      .filter((member) => member.project_id === row.id)
      .map((member) => ({
        id: member.user_id,
        name: member.profile?.display_name || member.profile?.username || "Collaborateur",
        role: member.role || member.profile?.role || "Collaborateur",
        level: member.access_level,
      }));
    const owner = owners.get(row.owner_id);
    if (!collaborators.some((member) => member.id === row.owner_id)) {
      collaborators.unshift({
        id: row.owner_id,
        name: owner?.display_name || owner?.username || "Créateur",
        role: owner?.role || "Créateur",
        level: "chef",
      });
    }
    return {
      ...row.data,
      id: row.id,
      ownerId: row.owner_id,
      creator: owner?.display_name || owner?.username || "Créateur CollabManga",
      collaborators,
    } as T;
  });
}

export async function loadProfileStudioProjects<T>(ownerId: string): Promise<T[]> {
  if (!ownerId) return [];
  const { data, error } = await getSupabase()
    .from("studio_projects")
    .select("data")
    .eq("owner_id", ownerId)
    .eq("catalog_visible", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.data as T);
}

/** Sauvegarde les projets dans Supabase et transfère les images base64 vers Storage. */
export async function saveStudioProjects<T>(projects: T[]): Promise<boolean> {
  const userId = await sessionUserId();
  if (!userId) return false;
  const nextSave = saveQueue
    .catch(() => true)
    .then(() => saveRemoteProjects(projects.filter(isProject) as StudioProjectLike[], userId));
  saveQueue = nextSave;
  return nextSave;
}

export async function deleteStudioProject(projectId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("studio_projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
}

export async function leaveStudioProject(projectId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("leave_studio_project", { target_project_id: projectId });
  if (error) throw new Error(error.message);
}

export async function updateStudioProjectMember(
  projectId: string,
  userId: string,
  accessLevel: "chef" | "editeur" | "collaborateur",
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("set_studio_project_member_level", {
    target_project_id: projectId,
    target_user_id: userId,
    next_access_level: accessLevel,
  });
  if (error) throw new Error(error.message);
}

export async function removeStudioProjectMember(projectId: string, userId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("remove_studio_project_member", {
    target_project_id: projectId,
    target_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function transferStudioProjectOwnership(
  projectId: string,
  newOwnerId: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc("transfer_studio_project_ownership", {
    target_project_id: projectId,
    new_owner_id: newOwnerId,
  });
  if (error) throw new Error(error.message);
}
