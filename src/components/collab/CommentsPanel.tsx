import { useEffect, useState } from "react";
import { addComment, listComments, type CommentEntityType, type DbComment } from "@/lib/db";

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
      <CommentComposer
        draft={draft}
        sending={sending}
        onChange={setDraft}
        onSend={() => void send()}
      />
      {error && <p style={{ fontSize: 12, fontWeight: 700, color: "#FF5F7E", margin: 0 }}>{error}</p>}

      {comments.length === 0 && (
        <p style={{ fontSize: 13, color: "#7F8CB3", margin: 0 }}>
          Aucun commentaire - sois le premier a en laisser un.
        </p>
      )}

      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}

function CommentComposer({
  draft,
  sending,
  onChange,
  onSend,
}: {
  draft: string;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <textarea
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Ecris un commentaire..."
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
        onClick={onSend}
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
        {sending ? "Envoi..." : "Envoyer"}
      </button>
    </div>
  );
}

function CommentItem({ comment }: { comment: DbComment }) {
  return (
    <div
      style={{
        background: "#0E193A",
        border: "1px solid rgba(133,154,206,0.18)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar author={comment.author} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#F7FAFF" }}>
              {comment.author?.display_name || comment.author?.username || "Membre"}
            </span>
            <span style={{ fontSize: 11, color: "#7F8CB3" }}>
              {new Date(comment.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "#B8C4E5",
              lineHeight: "20px",
              margin: "4px 0 0",
              whiteSpace: "pre-wrap",
            }}
          >
            {comment.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function Avatar({ author }: { author: DbComment["author"] }) {
  const name = author?.display_name || author?.username || "Membre";
  if (author?.avatar_url) {
    return (
      <img
        src={author.avatar_url}
        alt={name}
        style={{ width: 34, height: 34, borderRadius: 999, objectFit: "cover", flex: "0 0 auto" }}
      />
    );
  }
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        background: "rgba(57,255,136,0.14)",
        border: "1px solid rgba(57,255,136,0.35)",
        color: "#39FF88",
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
