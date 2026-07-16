import { useEffect, useState } from "react";
import { addComment, listComments, type CommentEntityType, type DbComment } from "@/lib/db";

/**
 * Panneau de commentaires réel (table Supabase `comments`).
 * Utilisé dans les popups de détail (illustrations, idées…) et le lecteur.
 */
export function CommentsPanel({ entityType, entityId }: { entityType: CommentEntityType; entityId: string }) {
  const [comments, setComments] = useState<DbComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listComments(entityType, entityId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => setComments([]));
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const created = await addComment(entityType, entityId, draft);
      setComments((current) => [...current, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {comments.length === 0 && (
        <p style={{ fontSize: 13, color: "#7F8CB3", margin: 0 }}>Aucun commentaire — sois le premier à en laisser un.</p>
      )}
      {comments.map((c) => (
        <div key={c.id} style={{ background: "#0E193A", border: "1px solid rgba(133,154,206,0.18)", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#F7FAFF" }}>
              {c.author?.display_name || c.author?.username || "Membre"}
            </span>
            <span style={{ fontSize: 11, color: "#7F8CB3" }}>
              {new Date(c.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#B8C4E5", lineHeight: "20px", margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{c.content}</p>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Écris un commentaire…"
          rows={2}
          style={{
            flex: 1,
            background: "#0E193A",
            border: "1px solid rgba(133,154,206,0.20)",
            borderRadius: 12,
            padding: "10px 12px",
            color: "#F7FAFF",
            fontSize: 13,
            resize: "vertical",
            minHeight: 44,
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          style={{
            alignSelf: "flex-end",
            background: "#39FF88",
            color: "#04111E",
            border: "none",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            opacity: sending || !draft.trim() ? 0.6 : 1,
          }}
        >
          {sending ? "Envoi…" : "Envoyer"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, fontWeight: 700, color: "#FF5F7E", margin: 0 }}>{error}</p>}
    </div>
  );
}
