import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Panel, Input } from "@/components/cma/Layout";
import {
  clearHistory,
  loadHistory,
  removeHistoryEntry,
  type MangaHistoryEntry,
} from "@/lib/manga-history";
import { Search, Image as ImageIcon, Download, Trash2, Wand2, X } from "lucide-react";
import { openImageEditor } from "@/lib/image-edit-workspace";

export const Route = createFileRoute("/ai/history")({
  head: () => ({ meta: [{ title: "History — CollabManga AI" }] }),
  component: HistoryPage,
});

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function downloadEntry(entry: MangaHistoryEntry) {
  const link = document.createElement("a");
  link.href = entry.imageUrl;
  link.download = `collabmanga-page-${new Date(entry.createdAt).getTime()}.png`;
  link.click();
}

function entryAspectRatio(size: string) {
  if (size === "1536x1024" || size === "3:2") return "3 / 2";
  if (size === "1024x1536" || size === "2:3") return "2 / 3";
  return "1 / 1";
}

function editEntry(entry: MangaHistoryEntry) {
  const context = entry.editContext ?? {
    originalImageUrl: entry.imageUrl,
    currentImageUrl: entry.imageUrl,
    prompt: "",
    selectedCharacterIds: [],
    references: [],
    aspectRatio: entryAspectRatio(entry.size) === "3 / 2" ? ("3:2" as const) : ("2:3" as const),
    source: entry.source,
  };
  void openImageEditor({ ...context, currentImageUrl: entry.imageUrl });
}

function HistoryPage() {
  const [entries, setEntries] = useState<MangaHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<MangaHistoryEntry | null>(null);

  useEffect(() => {
    void loadHistory().then((list) => {
      setEntries(list);
      setLoaded(true);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.prompt.toLowerCase().includes(q) ||
        entry.finalPrompt.toLowerCase().includes(q) ||
        entry.source?.toLowerCase().includes(q) ||
        entry.title?.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const remove = (id: string) => {
    void removeHistoryEntry(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setPreview((current) => (current?.id === id ? null : current));
  };

  const clearAll = () => {
    void clearHistory();
    setEntries([]);
    setPreview(null);
  };

  return (
    <>
      <PageHeader
        title="History"
        description="Toutes les images generees sont conservees localement sur cet appareil."
        actions={
          entries.length > 0 ? (
            <button className="cma-btn-secondary" onClick={clearAll}>
              <Trash2 size={16} /> Vider l'historique
            </button>
          ) : undefined
        }
      />

      <Panel className="mb-6">
        <div className="relative">
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <Input
            placeholder="Rechercher par prompt ou par outil"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      </Panel>

      {loaded && entries.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div
              className="grid place-items-center"
              style={{ width: 56, height: 56, borderRadius: 14, background: "var(--bg-input)" }}
            >
              <ImageIcon size={24} style={{ color: "var(--text-muted)" }} />
            </div>
            <div>
              <div className="text-[15px] font-bold">Aucune image generee</div>
              <div className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
                Les images de tous les outils AI apparaitront automatiquement ici.
              </div>
            </div>
            <Link to="/ai/manga-page" className="cma-btn-primary" style={{ marginTop: 4 }}>
              <Wand2 size={16} /> Ouvrir Manga Page Creator
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((entry) => (
            <Panel key={entry.id} padding={0} className="overflow-hidden">
              <button
                onClick={() => setPreview(entry)}
                className="block w-full"
                style={{
                  aspectRatio: entryAspectRatio(entry.size),
                  background: "var(--bg-input)",
                }}
              >
                <img
                  src={entry.imageUrl}
                  alt={entry.prompt}
                  className="h-full w-full object-contain"
                />
              </button>
              <div className="p-3">
                <p
                  className="line-clamp-2 text-[12px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {entry.title || entry.prompt || "Image generee"}
                </p>
                {entry.source && (
                  <p className="mt-1 truncate text-[10px] font-bold uppercase text-accent">
                    {entry.source}
                  </p>
                )}
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {formatDate(entry.createdAt)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="cma-icon-btn"
                    aria-label="Modify"
                    onClick={() => editEntry(entry)}
                  >
                    <Wand2 size={14} />
                  </button>
                  <button
                    className="cma-icon-btn"
                    aria-label="Download"
                    onClick={() => downloadEntry(entry)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="cma-icon-btn"
                    aria-label="Delete"
                    onClick={() => remove(entry.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(3,7,18,0.82)" }}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative flex max-h-full max-w-[900px] flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreview(null)}
              aria-label="Close"
              className="absolute -right-3 -top-3 z-10 grid place-items-center rounded-full"
              style={{
                width: 34,
                height: 34,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <X size={16} />
            </button>
            <img
              src={preview.imageUrl}
              alt={preview.prompt}
              className="min-h-0 rounded-[14px] object-contain"
              style={{ maxHeight: "78vh" }}
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <p
                className="min-w-0 flex-1 truncate text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {preview.prompt}
              </p>
              <button className="cma-btn-secondary" onClick={() => downloadEntry(preview)}>
                <Download size={16} /> Download
              </button>
              <button className="cma-btn-primary" onClick={() => editEntry(preview)}>
                <Wand2 size={16} /> Modifier
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
