import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  ImageIcon,
  Images,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/cma/Layout";
import { hasPendingGeneration, resumeDurableGeneration, runDurableGeneration } from "@/lib/durable-generation";
import { notifyCreditsChanged } from "@/lib/credits-events";
import { recordGeneratedImage } from "@/lib/manga-history";
import { loadSession, saveSession } from "@/lib/manga-session";
import { createId } from "@/lib/manga-workspace";
import type { FreeImageResult } from "@/server-functions/free-image";

export const Route = createFileRoute("/ai/free-studio")({
  head: () => ({ meta: [{ title: "Studio libre - CollabManga AI" }] }),
  component: FreeStudioPage,
});

type StudioTab = "references" | "prompt";
type AspectRatio = "2:3" | "3:2";
type StudioReference = {
  id: string;
  name: string;
  imageDataUrl: string;
  mimeType?: string;
  description: string;
};
type StudioSnapshot = {
  tab?: StudioTab;
  references?: StudioReference[];
  prompt?: string;
  aspectRatio?: AspectRatio;
  result?: FreeImageResult | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

function fileName(file: File) {
  return (
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Reference"
  );
}

function FreeStudioPage() {
  const [tab, setTab] = useState<StudioTab>("references");
  const [references, setReferences] = useState<StudioReference[]>([]);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("2:3");
  const [result, setResult] = useState<FreeImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadSession<StudioSnapshot>("free-studio").then((snapshot) => {
      if (snapshot) {
        setTab(snapshot.tab ?? "references");
        setReferences(snapshot.references ?? []);
        setPrompt(snapshot.prompt ?? "");
        setAspectRatio(snapshot.aspectRatio ?? "2:3");
        setResult(snapshot.result ?? null);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!hasPendingGeneration("free-studio")) return;
    setIsGenerating(true);
    void resumeDurableGeneration<FreeImageResult>("free-studio").then((generated) => {
      if (generated) setResult(generated);
    }).catch((err) => setError(err instanceof Error ? err.message : "Free generation failed."))
      .finally(() => setIsGenerating(false));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSession<StudioSnapshot>("free-studio", {
      tab,
      references,
      prompt,
      aspectRatio,
      result,
    });
  }, [aspectRatio, loaded, prompt, references, result, tab]);

  const importReferences = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const imported = await Promise.all(
      imageFiles.map(async (file) => ({
        id: createId("free-reference"),
        name: fileName(file),
        imageDataUrl: await fileToDataUrl(file),
        mimeType: file.type || undefined,
        description: "",
      })),
    );
    setReferences((current) => [...current, ...imported]);
    setResult(null);
  };

  const updateReference = (id: string, patch: Partial<StudioReference>) => {
    setReferences((current) =>
      current.map((reference) => (reference.id === id ? { ...reference, ...patch } : reference)),
    );
  };

  const generate = async () => {
    if (!prompt.trim()) {
      setTab("prompt");
      setError("Decris l'image que tu veux generer.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const generated = await runDurableGeneration<FreeImageResult>(
        "free-studio",
        "/api/free-studio/generate",
        { prompt, references, aspectRatio },
      );
      setResult(generated);
      void recordGeneratedImage({
        source: "Studio libre",
        title: prompt.trim().slice(0, 70) || "Generation libre",
        prompt,
        result: generated,
        editContext: {
          originalImageUrl: generated.imageUrl,
          currentImageUrl: generated.imageUrl,
          prompt: "",
          selectedCharacterIds: [],
          references: references.map((reference) => ({ ...reference, role: "Inspiration" as const })),
          aspectRatio,
          source: "Studio libre",
        },
      });
      notifyCreditsChanged();
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : "Free generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const download = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `collabmanga-studio-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader
        title="Studio libre"
        description="Decris librement ton image : le prompt est structure avant la generation."
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="shadow-panel flex min-h-[680px] min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <div className="flex items-center gap-1 border-b border-border p-3">
            {(
              [
                { id: "references", label: "References", icon: Images },
                { id: "prompt", label: "Prompt", icon: FileText },
              ] as const
            ).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] text-[12px] font-bold transition ${
                  tab === entry.id
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </button>
            ))}
          </div>

          <div className="scroll-dark min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "references" && (
              <ReferenceLibrary
                references={references}
                onImport={importReferences}
                onUpdate={updateReference}
                onRemove={(id) =>
                  setReferences((current) => current.filter((reference) => reference.id !== id))
                }
              />
            )}

            {tab === "prompt" && (
              <div className="flex flex-col gap-4">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={18}
                  placeholder="Decris la scene, les personnages, leurs expressions, la prise de vue, le style ou la structure de la planche..."
                  className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <div>
                  <p className="mb-2 text-[12px] font-bold text-text-secondary">Format</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["2:3", "3:2"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`h-10 rounded-[10px] border text-[12px] font-bold ${
                          aspectRatio === ratio
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-border bg-surface-3 text-text-secondary"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            {error && <p className="mb-3 text-[12px] font-semibold text-danger">{error}</p>}
            <button
              type="button"
              onClick={generate}
              disabled={!prompt.trim() || isGenerating}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-extrabold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Generation..." : "Generer l'image"}
            </button>
          </div>
        </section>

        <section className="shadow-panel flex min-h-[680px] min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex h-[65px] items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-bold">Image generee</h2>
            </div>
            <button
              type="button"
              onClick={download}
              disabled={!result}
              aria-label="Telecharger"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface-3 text-text-secondary disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
            <div
              className="flex max-h-[720px] w-full items-center justify-center overflow-hidden rounded-[12px] bg-stage"
              style={{ aspectRatio: aspectRatio === "3:2" ? "3 / 2" : "2 / 3" }}
            >
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 text-text-secondary">
                  <Sparkles className="h-8 w-8 animate-pulse text-accent" />
                  <p className="text-[13px] font-semibold">Optimisation et generation...</p>
                </div>
              ) : result ? (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="flex h-full w-full cursor-zoom-in items-center justify-center"
                >
                  <img
                    src={result.imageUrl}
                    alt="Generation du Studio libre"
                    className="h-full w-full object-contain"
                  />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3 px-8 text-center text-text-muted">
                  <ImageIcon className="h-9 w-9" />
                  <p className="text-[13px] font-semibold">L'image generee apparaitra ici.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {lightbox && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative max-h-full max-w-[1200px]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Fermer"
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={result.imageUrl}
              alt="Generation du Studio libre"
              className="max-h-[88vh] max-w-full rounded-[14px] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceLibrary({
  references,
  onImport,
  onUpdate,
  onRemove,
}: {
  references: StudioReference[];
  onImport: (files: FileList | null) => void;
  onUpdate: (id: string, patch: Partial<StudioReference>) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onImport(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[150px] w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-border-strong bg-surface-3 hover:border-accent"
      >
        <Upload className="h-8 w-8 text-text-muted" />
        <span className="text-[13px] font-bold">Ajouter des references</span>
      </button>

      {references.map((reference) => (
        <div
          key={reference.id}
          className="grid grid-cols-[100px_minmax(0,1fr)_36px] gap-3 rounded-[14px] border border-border bg-surface-3 p-3"
        >
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-stage">
            <img
              src={reference.imageDataUrl}
              alt={reference.name}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <input
              value={reference.name}
              onChange={(event) => onUpdate(reference.id, { name: event.target.value })}
              className="h-9 w-full rounded-[9px] border border-border bg-input px-3 text-[12px] font-bold outline-none focus:border-accent"
            />
            <textarea
              value={reference.description}
              onChange={(event) => onUpdate(reference.id, { description: event.target.value })}
              rows={2}
              placeholder="Utilite : pose, personnage, decor, style..."
              className="w-full resize-none rounded-[9px] border border-border bg-input px-3 py-2 text-[11px] outline-none focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(reference.id)}
            aria-label="Supprimer"
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-surface-2 text-text-muted hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {references.length > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface-3 text-[12px] font-bold text-text-secondary hover:text-accent"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      )}
    </div>
  );
}
