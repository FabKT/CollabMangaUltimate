import { getSupabase } from "@/lib/supabase";

export type SharedThreadKind = "project" | "sponsorship";

export type SharedThreadMessage = {
  id: string;
  authorId: string;
  author: string;
  content: string;
  createdAt: string;
};

export function threadKey(kind: SharedThreadKind, id: string) {
  return `${kind}:${id}`;
}

function splitThreadKey(key: string): [SharedThreadKind, string] {
  const separator = key.indexOf(":");
  const kind = key.slice(0, separator);
  const id = key.slice(separator + 1);
  if ((kind !== "project" && kind !== "sponsorship") || !id) {
    throw new Error("Fil de discussion invalide.");
  }
  return [kind, id];
}

export async function listThreadMessages(key: string): Promise<SharedThreadMessage[]> {
  const [threadKind, threadId] = splitThreadKey(key);
  const sb = getSupabase();
  const { data, error } = await sb
    .from("shared_thread_messages")
    .select("id, author_id, content, created_at, author:profiles!shared_thread_messages_author_id_fkey(display_name, username)")
    .eq("thread_kind", threadKind)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      id: row.id,
      authorId: row.author_id,
      author: author?.display_name || author?.username || "Membre",
      content: row.content,
      createdAt: row.created_at,
    };
  });
}

export async function appendThreadMessage(
  key: string,
  content: string,
): Promise<SharedThreadMessage> {
  const [threadKind, threadId] = splitThreadKey(key);
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour envoyer un message.");
  const { data, error } = await sb
    .from("shared_thread_messages")
    .insert({ thread_kind: threadKind, thread_id: threadId, author_id: uid, content })
    .select("id, author_id, content, created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    authorId: data.author_id,
    author: "Toi",
    content: data.content,
    createdAt: data.created_at,
  };
}

export function subscribeThreadMessages(
  key: string,
  onMessage: (message: SharedThreadMessage) => void,
) {
  const [threadKind, threadId] = splitThreadKey(key);
  const sb = getSupabase();
  const channel = sb
    .channel(`shared-thread:${threadKind}:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "shared_thread_messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const row = payload.new as {
          id: string;
          thread_kind: SharedThreadKind;
          thread_id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        if (row.thread_kind !== threadKind) return;
        onMessage({
          id: row.id,
          authorId: row.author_id,
          author: "Membre",
          content: row.content,
          createdAt: row.created_at,
        });
      },
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
