import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/cma/Layout";
import { loadSession, saveSession } from "@/lib/manga-session";
import { createId } from "@/lib/manga-workspace";
import { MANGA_STYLES, type MangaStyle } from "@/lib/manga-styles";
import type { SketchFinalResult } from "@/server-functions/sketch-final-image";
import {
  Check,
  Download,
  FileText,
  ImageIcon,
  Images as ImagesIcon,
  Palette,
  PenLine,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/ai/sketch-final")({
  head: () => ({ meta: [{ title: "Croquis -> Final - CollabManga AI" }] }),
  component: SketchFinalPage,
});

type SketchTab = "sketch" | "style" | "references" | "prompt";

type ElementReference = {
  id: string;
  name: string;
  imageDataUrl: string;
  description?: string;
};

type SketchFinalSnapshot = {
  tab?: SketchTab;
  sketchImage?: string | null;
  styleId?: string;
  customStyleImage?: string | null;
  elementReferences?: ElementReference[];
  notes?: string;
  result?: SketchFinalResult | null;
};

const DEFAULT_STYLE_ID = MANGA_STYLES.find((style) => style.id === "current")?.id ?? MANGA_STYLES[0]?.id ?? "";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(blob);
  });
}

async function imageSourceToDataUrl(src?: string) {
  if (!src) return undefined;
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) return undefined;
  return blobToDataUrl(await response.blob());
}

function getImageSizeForGeneration(src: string): Promise<"1024x1536" | "1536x1024"> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth >= image.naturalHeight ? "1536x1024" : "1024x1536");
    image.onerror = () => resolve("1024x1536");
    image.src = src;
  });
}

function SketchFinalPage() {
  const [tab, setTab] = useState<SketchTab>("sketch");
  const [sketchImage, setSketchImage] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [customStyleImage, setCustomStyleImage] = useState<string | null>(null);
  const [elementReferences, setElementReferences] = useState<ElementReference[]>([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SketchFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const snap = loadSession<SketchFinalSnapshot>("sketch-final");
    if (snap) {
      setTab(snap.tab ?? "sketch");
      setSketchImage(snap.sketchImage ?? null);
      setStyleId(snap.styleId ?? DEFAULT_STYLE_ID);
      setCustomStyleImage(snap.customStyleImage ?? null);
      setElementReferences(snap.elementReferences ?? []);
      setNotes(snap.notes ?? "");
      if (snap.result) setResult(snap.result);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveSession<SketchFinalSnapshot>("sketch-final", {
      tab,
      sketchImage,
      styleId,
      customStyleImage,
      elementReferences,
      notes,
      result,
    });
  }, [loaded, tab, sketchImage, styleId, customStyleImage, elementReferences, notes, result]);

  const activeStyle = MANGA_STYLES.find((style) => style.id === styleId) ?? MANGA_STYLES[0];
  const canGenerate = Boolean(sketchImage && (customStyleImage || activeStyle?.face));

  const importSketch = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    setSketchImage(await fileToDataUrl(file));
    setResult(null);
  };

  const importStyle = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    setCustomStyleImage(await fileToDataUrl(file));
  };

  const importElementReferences = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const imported = await Promise.all(
      imageFiles.slice(0, 6).map(async (file) => ({
        id: createId("sketch-ref"),
        name: file.name.replace(/\.[^.]+$/, "") || "Reference",
        imageDataUrl: await fileToDataUrl(file),
        description: "",
      })),
    );
    setElementReferences((current) => [...imported, ...current].slice(0, 6));
  };

  const generate = async () => {
    if (!sketchImage) {
      setTab("sketch");
      setError("Importe d'abord le croquis.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      const styleImageDataUrl = customStyleImage ?? (await imageSourceToDataUrl(activeStyle?.face));
      if (!styleImageDataUrl) {
        setTab("style");
        throw new Error("Ajoute une image de style final.");
      }

      const size = await getImageSizeForGeneration(sketchImage);
      const response = await fetch("/api/sketch-final/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sketchImageDataUrl: sketchImage,
          styleImageDataUrl,
          styleId: activeStyle?.id ?? "custom",
          styleName: customStyleImage ? "Style personnalise" : (activeStyle?.name ?? "Style final"),
          styleDescription: customStyleImage ? "" : (activeStyle?.description ?? ""),
          elementReferences,
          notes: notes.trim(),
          size,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Sketch finishing failed (${response.status}).`);
      }
      setResult(payload as SketchFinalResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sketch finishing failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const download = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `collabmanga-final-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader
        title="Croquis -> Final"
        description="Transforme un croquis en image finale en verrouillant la composition, le style et les references d'elements."
        actions={
          <button
            onClick={generate}
            disabled={isGenerating || !canGenerate}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {isGenerating ? "Generation..." : "Generer l'image"}
          </button>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(330px,420px)_minmax(0,1fr)]">
        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <div className="flex items-center gap-1 border-b border-border p-3">
            {(
              [
                { id: "sketch", label: "Croquis", icon: PenLine },
                { id: "style", label: "Style", icon: Palette },
                { id: "references", label: "Elements", icon: ImagesIcon },
                { id: "prompt", label: "Prompt", icon: FileText },
              ] as const
            ).map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[12px] text-[12px] font-bold transition ${
                  tab === entry.id
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <entry.icon className="h-4 w-4" />
                <span className="truncate">{entry.label}</span>
              </button>
            ))}
          </div>

          <div className="scroll-dark min-h-[420px] flex-1 overflow-y-auto p-4">
            {tab === "sketch" && (
              <div className="flex flex-col gap-3">
                <SectionIntro
                  title="Image A - croquis"
                  text="Le croquis controle la composition, la pose, l'expression, la camera, les bulles et tous les placements."
                />
                <UploadPreview
                  image={sketchImage}
                  title="Importer le croquis"
                  emptyText="Glisse le croquis ici"
                  onImport={importSketch}
                  onRemove={() => {
                    setSketchImage(null);
                    setResult(null);
                  }}
                />
              </div>
            )}

            {tab === "style" && (
              <StyleTab
                activeStyle={activeStyle}
                styleId={styleId}
                customStyleImage={customStyleImage}
                onSelectStyle={(nextStyle) => {
                  setStyleId(nextStyle.id);
                  setCustomStyleImage(null);
                }}
                onImportStyle={importStyle}
                onRemoveCustomStyle={() => setCustomStyleImage(null)}
              />
            )}

            {tab === "references" && (
              <ElementReferencesTab
                references={elementReferences}
                onImport={importElementReferences}
                onUpdate={(id, patch) =>
                  setElementReferences((current) =>
                    current.map((reference) =>
                      reference.id === id ? { ...reference, ...patch } : reference,
                    ),
                  )
                }
                onRemove={(id) =>
                  setElementReferences((current) => current.filter((reference) => reference.id !== id))
                }
              />
            )}

            {tab === "prompt" && (
              <div className="flex flex-col gap-3">
                <SectionIntro
                  title="Instructions optionnelles"
                  text="Ajoute seulement ce qui doit etre precise. La pose, le cadrage et les placements restent verrouilles par le croquis."
                />
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={10}
                  placeholder="Ex: garder le regard plus intense, rendre le manteau noir uni, nettoyer les mains sans changer leur position..."
                  className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <GenerationChecklist
                  hasSketch={Boolean(sketchImage)}
                  hasStyle={Boolean(customStyleImage || activeStyle?.face)}
                  referenceCount={elementReferences.length}
                />
                <button
                  onClick={generate}
                  disabled={isGenerating || !canGenerate}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wand2 className="h-4 w-4" />
                  {isGenerating ? "Generation..." : "Generer l'image finale"}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <h2 className="truncate font-display text-base font-bold">Image finale</h2>
            </div>
            <button
              onClick={download}
              disabled={!result}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </header>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            <div className="flex h-full min-h-[520px] w-full items-center justify-center overflow-hidden rounded-[12px] bg-stage">
              {isGenerating ? (
                <GeneratingIndicator />
              ) : error ? (
                <div className="flex flex-col items-center justify-center px-8 text-center text-text-secondary">
                  <X className="mb-3 h-8 w-8 text-danger" />
                  <p className="text-[13px] font-semibold">{error}</p>
                </div>
              ) : result ? (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="flex h-full w-full cursor-zoom-in items-center justify-center"
                  title="Voir en grand"
                >
                  <img src={result.imageUrl} alt="Rendu final" className="max-h-full max-w-full object-contain" />
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-8 text-center text-text-muted">
                  <Sparkles className="h-8 w-8" />
                  <p className="text-[13px] font-semibold">Le rendu final apparaitra ici.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {lightbox && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,7,18,0.85)" }}
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative flex max-h-full w-full max-w-[1100px] flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={result.imageUrl}
              alt="Rendu final"
              className="w-full rounded-[14px] object-contain"
              style={{ maxHeight: "82vh" }}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={download}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
              >
                <Download className="h-4 w-4" />
                Telecharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[13px] font-bold text-text-primary">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-text-secondary">{text}</p>
    </div>
  );
}

function UploadPreview({
  image,
  title,
  emptyText,
  onImport,
  onRemove,
}: {
  image: string | null;
  title: string;
  emptyText: string;
  onImport: (files: FileList | null) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="rounded-[14px] border border-border bg-surface-3 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onImport(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onImport(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      {image ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-[12px] border border-border bg-stage"
            title="Remplacer l'image"
          >
            <img src={image} alt={title} className="max-h-[360px] max-w-full object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface-2 text-[12px] font-bold text-text-secondary hover:border-accent hover:text-accent"
            >
              <Upload className="h-4 w-4" />
              Remplacer
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                aria-label="Supprimer"
                className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-muted hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border-strong bg-surface-2 px-4 text-text-primary hover:border-accent hover:text-accent"
        >
          <ImageIcon className="h-8 w-8 text-text-muted" />
          <span className="text-[13px] font-bold">{title}</span>
          <span className="text-[12px] text-text-muted">{emptyText}</span>
        </button>
      )}
    </div>
  );
}

function StyleTab({
  activeStyle,
  styleId,
  customStyleImage,
  onSelectStyle,
  onImportStyle,
  onRemoveCustomStyle,
}: {
  activeStyle?: MangaStyle;
  styleId: string;
  customStyleImage: string | null;
  onSelectStyle: (style: MangaStyle) => void;
  onImportStyle: (files: FileList | null) => void;
  onRemoveCustomStyle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionIntro
        title="Image B - style final"
        text="Le style final controle l'encrage, les yeux, les cheveux, les valeurs, la texture et le niveau de finition."
      />
      <div className="grid grid-cols-2 gap-3">
        {MANGA_STYLES.map((style) => {
          const selected = style.id === styleId && !customStyleImage;
          return (
            <button
              key={style.id}
              onClick={() => onSelectStyle(style)}
              className={`flex flex-col gap-2 rounded-[14px] border p-2 transition ${
                selected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3 hover:border-accent"
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-[10px] border border-border bg-surface-2">
                <img src={style.face} alt={style.name} className="h-full w-full object-cover" />
                {selected && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <span className="truncate text-center text-[12px] font-bold text-text-primary">{style.name}</span>
            </button>
          );
        })}
      </div>
      <UploadPreview
        image={customStyleImage}
        title="Importer un style final"
        emptyText={activeStyle ? `Style actuel: ${activeStyle.name}` : "Reference de style obligatoire"}
        onImport={onImportStyle}
        onRemove={onRemoveCustomStyle}
      />
    </div>
  );
}

function ElementReferencesTab({
  references,
  onImport,
  onUpdate,
  onRemove,
}: {
  references: ElementReference[];
  onImport: (files: FileList | null) => void;
  onUpdate: (id: string, patch: Partial<ElementReference>) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <SectionIntro
        title="Images C/D/E - elements du croquis"
        text="Ajoute les personnages, objets, tenues ou decors qui existent deja dans le croquis. Ces images definissent l'identite, pas la pose."
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          onImport(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[72px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong bg-surface-2 px-3 text-text-primary hover:border-accent hover:text-accent"
      >
        <Upload className="h-5 w-5" />
        <span className="text-[13px] font-bold">Importer des references d'elements</span>
      </button>

      {references.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-surface-3/50 p-5 text-center">
          <ImagesIcon className="mx-auto mb-2 h-5 w-5 text-text-muted" />
          <p className="text-[13px] font-semibold text-text-secondary">Aucune reference ajoutee</p>
        </div>
      ) : (
        references.map((reference, index) => (
          <div key={reference.id} className="rounded-[14px] border border-border bg-surface-3 p-3">
            <div className="flex gap-3">
              <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-surface-2">
                <img src={reference.imageDataUrl} alt={reference.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-text-primary">
                      Image {String.fromCharCode(67 + index)} - {reference.name}
                    </p>
                    <p className="text-[11px] text-text-muted">Identite de l'element uniquement</p>
                  </div>
                  <button
                    onClick={() => onRemove(reference.id)}
                    aria-label="Supprimer"
                    className="rounded-md p-1 text-text-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={reference.description ?? ""}
                  onChange={(event) => onUpdate(reference.id, { description: event.target.value })}
                  rows={2}
                  placeholder="Ex: visage du heros, uniforme, arme, decor au fond..."
                  className="w-full resize-none rounded-[10px] border border-border bg-input px-3 py-2 text-[12px] leading-5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function GenerationChecklist({
  hasSketch,
  hasStyle,
  referenceCount,
}: {
  hasSketch: boolean;
  hasStyle: boolean;
  referenceCount: number;
}) {
  const items = [
    { label: "Croquis importe", done: hasSketch },
    { label: "Style final pret", done: hasStyle },
    { label: `${referenceCount} reference${referenceCount > 1 ? "s" : ""} d'element`, done: true },
  ];
  return (
    <div className="rounded-[14px] border border-border bg-surface-3 p-3">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[12px] font-semibold text-text-secondary">
            <span
              className={`grid h-5 w-5 place-items-center rounded-full border ${
                item.done
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border bg-surface-2 text-text-muted"
              }`}
            >
              {item.done ? <Check className="h-3 w-3" /> : null}
            </span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneratingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 text-center text-text-secondary">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-border" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-accent" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 animate-pulse text-accent" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-text-primary">Finalisation en cours</p>
        <p className="mt-1 text-[12px] text-text-muted">Le croquis est nettoye et rendu dans le style choisi...</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-2 w-2 animate-bounce rounded-full bg-accent"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
