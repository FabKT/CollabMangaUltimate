import { useState } from "react";
import { Flag, Heart, MessageSquare, EyeOff } from "lucide-react";

interface CommentModel {
  id: string;
  user: string;
  time: string;
  text: string;
  likes: number;
  spoiler?: boolean;
}

const SEED: CommentModel[] = [
  { id: "c1", user: "Username", time: "Recently", text: "Comment text placeholder discussing the pacing and art of this chapter.", likes: 0 },
  { id: "c2", user: "Username", time: "Recently", text: "Comment text placeholder with a strong reaction to a key scene.", likes: 0, spoiler: true },
  { id: "c3", user: "Username", time: "Recently", text: "Comment text placeholder asking a question about the next chapter.", likes: 0 },
];

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-extrabold"
      style={{
        background: "var(--color-input-bg)",
        border: "1px solid var(--color-border-default)",
        color: "var(--color-text-secondary)",
      }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function CommentCard({ c }: { c: CommentModel }) {
  const [revealed, setRevealed] = useState(!c.spoiler);
  const [liked, setLiked] = useState(false);
  return (
    <article
      className="rounded-2xl p-4"
      style={{ background: "var(--color-elevated)", border: "1px solid var(--color-border-default)" }}
    >
      <header className="flex items-center gap-3">
        <Avatar name={c.user} />
        <div className="flex-1">
          <p className="text-[14px] font-bold text-[color:var(--color-text-primary)]">{c.user}</p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">{c.time}</p>
        </div>
        {c.spoiler && <span className="chip-info">Spoiler</span>}
      </header>
      <div className="mt-3">
        {revealed ? (
          <p className="text-[14px] leading-[22px] text-[color:var(--color-text-secondary)]">{c.text}</p>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "var(--color-input-bg)", border: "1px dashed var(--color-border-default)" }}>
            <span className="inline-flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
              <EyeOff className="h-4 w-4" />
              Spoiler hidden
            </span>
            <button type="button" className="btn-ghost h-9 px-3" onClick={() => setRevealed(true)}>
              Reveal
            </button>
          </div>
        )}
      </div>
      <footer className="mt-3 flex items-center gap-1 text-[12px]">
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          className="btn-ghost h-9 gap-1.5 px-2"
          aria-pressed={liked}
          style={liked ? { color: "var(--color-neon)" } : undefined}
        >
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} /> Like
        </button>
        <button type="button" className="btn-ghost h-9 gap-1.5 px-2">
          <MessageSquare className="h-4 w-4" /> Reply
        </button>
        <button type="button" className="btn-ghost h-9 gap-1.5 px-2 ml-auto">
          <Flag className="h-4 w-4" /> Report
        </button>
      </footer>
    </article>
  );
}

export function CommentsSection() {
  const [sort, setSort] = useState("Newest");
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState(SEED);

  const submit = () => {
    if (!draft.trim()) return;
    setComments((cs) => [
      { id: `c${Date.now()}`, user: "Username", time: "Just now", text: draft.trim(), likes: 0 },
      ...cs,
    ]);
    setDraft("");
  };

  return (
    <section className="panel p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[20px] font-bold leading-7">Comments</h2>
        <label className="inline-flex items-center gap-2 text-[13px] text-[color:var(--color-text-secondary)]">
          <span className="meta-label">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input-field h-10 w-auto pr-9 text-[13px]"
            aria-label="Sort comments"
          >
            {["Newest", "Oldest", "Most liked"].map((o) => (
              <option key={o} className="bg-[color:var(--color-panel)]">{o}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="mb-6 space-y-3">
        <label htmlFor="comment-composer" className="meta-label">Add a comment</label>
        <textarea
          id="comment-composer"
          className="textarea-field"
          placeholder="Share your thoughts about this chapter…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex justify-end">
          <button type="button" onClick={submit} className="btn-primary" disabled={!draft.trim()}>
            Post Comment
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "var(--color-elevated)", border: "1px dashed var(--color-border-default)" }}>
            <p className="font-display text-[18px] font-bold">No comments yet</p>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">Be the first to comment on this chapter.</p>
          </div>
        ) : (
          comments.map((c) => <CommentCard key={c.id} c={c} />)
        )}
      </div>
    </section>
  );
}