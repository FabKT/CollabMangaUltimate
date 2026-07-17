import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/cma/Layout";
import { loadSession, saveSession } from "@/lib/manga-session";
import { MANGA_STYLES } from "@/lib/manga-styles";
import type { StyleTransferResult } from "@/server-functions/style-transfer-image";
import { authJsonHeaders } from "@/lib/auth-header";
import {
  Wand2,
  Upload,
  Plus,
  Check,
  Download,
  X,
  Sparkles,
  ImageIcon,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/ai/style-transfer")({
  head: () => ({ meta: [{ title: "Transfert de style — CollabManga AI" }] }),
  component: StyleTransferPage,
});

const CUSTOM_STYLE = "custom";

type StyleTransferSnapshot = {
  targetStyleId?: string;
  customStyleImages?: string[];
  baseImage?: string | null;
  result?: StyleTransferResult | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

function StyleTransferPage() {
  const [targetStyleId, setTargetStyleId] = useState<string>(MANGA_STYLES[0].id);
  const [customStyleImages, setCustomStyleImages] = useState<string[]>([]);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [result, setResult] = useState<StyleTransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const snap = loadSession<StyleTransferSnapshot>("style-transfer");
    if (snap) {
      setTargetStyleId(snap.targetStyleId ?? MANGA_STYLES[0].id);
      setCustomStyleImages(snap.customStyleImages ?? []);
      setBaseImage(snap.baseImage ?? null);
      if (snap.result) setResult(snap.result);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveSession<StyleTransferSnapshot>("style-transfer", {
      targetStyleId,
      customStyleImages,
      baseImage,
      result,
    });
  }, [loaded, targetStyleId, customStyleImages, baseImage, result]);

  const isCustom = targetStyleId === CUSTOM_STYLE;
  const activeStyle = MANGA_STYLES.find((style) => style.id === targetStyleId);
  const canGenerate = Boolean(baseImage) && (!isCustom || customStyleImages.length > 0);

  const importBase = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setBaseImage(await fileToDataUrl(file));
  };

  const importCustomStyles = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const urls = await Promise.all(imageFiles.slice(0, 8).map((file) => fileToDataUrl(file)));
    setCustomStyleImages((current) => [...current, ...urls].slice(0, 8));
  };

  const generate = async () => {
    if (!canGenerate || !baseImage) return;
    setError(null);
    setIsGenerating(true);
    try {
      const response = await fetch("/api/style-transfer/generate", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({
          baseImageDataUrl: baseImage,
          styleId: isCustom ? CUSTOM_STYLE : targetStyleId,
          styleName: isCustom ? "Style personnalisé" : (activeStyle?.name ?? ""),
          styleDescription: isCustom ? "" : (activeStyle?.description ?? ""),
          customStyleImages: isCustom ? customStyleImages : [],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Style transfer failed (${response.status}).`);
      }
      setResult(payload as StyleTransferResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Style transfer failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const download = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `collabmanga-restyle-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader
        title="Transfert de style"
        description="Prends un personnage comme base et régénère-le dans un autre style."
        actions={
          <button
            onClick={generate}
            disabled={isGenerating || !canGenerate}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {isGenerating ? "Transfert…" : "Transférer le style"}
          </button>
        }
      />

      {/* Style band — full width */}
      <section className="shadow-panel mb-4 rounded-[18px] border border-border bg-surface-2 p-3">
        <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Style cible
        </div>
        <div className="scroll-dark flex gap-3 overflow-x-auto pb-1">
          {MANGA_STYLES.map((style) => {
            const selected = style.id === targetStyleId;
            return (
              <button
                key={style.id}
                onClick={() => setTargetStyleId(style.id)}
                className={`flex w-[112px] shrink-0 flex-col gap-2 rounded-[14px] border p-2 transition ${
                  selected
                    ? "border-accent-border bg-accent-soft/30"
                    : "border-border bg-surface-3 hover:border-accent"
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
                <span className="truncate text-center text-[12px] font-bold text-text-primary">
                  {style.name}
                </span>
              </button>
            );
          })}

          {/* "Autre" — custom style from imported images */}
          <CustomStyleCard
            selected={isCustom}
            images={customStyleImages}
            onSelect={() => setTargetStyleId(CUSTOM_STYLE)}
            onImport={importCustomStyles}
            onRemove={(index) =>
              setCustomStyleImages((current) => current.filter((_, i) => i !== index))
            }
          />
        </div>
      </section>

      {/* Before / After — two equal parts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Before */}
        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                Avant
              </span>
              <h2 className="font-display text-base font-bold">Personnage de base</h2>
            </div>
            {baseImage && (
              <button
                onClick={() => setBaseImage(null)}
                aria-label="Retirer"
                className="rounded-md p-1 text-text-muted hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </header>
          <div className="flex flex-1 items-center justify-center p-4">
            <BeforeArea baseImage={baseImage} onImport={importBase} />
          </div>
        </section>

        {/* After */}
        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-bold">Résultat</h2>
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
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[12px] bg-stage">
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
                  <img
                    src={result.imageUrl}
                    alt="Personnage restylé"
                    className="max-h-full max-w-full object-contain"
                  />
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-8 text-center text-text-muted">
                  <Sparkles className="h-8 w-8" />
                  <p className="text-[13px] font-semibold">Le personnage restylé apparaîtra ici.</p>
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
            className="relative flex max-h-full w-full max-w-[1000px] flex-col"
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
              alt="Personnage restylé"
              className="w-full rounded-[14px] object-contain"
              style={{ maxHeight: "82vh" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomStyleCard({
  selected,
  images,
  onSelect,
  onImport,
  onRemove,
}: {
  selected: boolean;
  images: string[];
  onSelect: () => void;
  onImport: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      className={`flex w-[112px] shrink-0 flex-col gap-2 rounded-[14px] border p-2 transition ${
        selected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          onImport(event.currentTarget.files);
          event.currentTarget.value = "";
          onSelect();
        }}
      />
      <button
        onClick={() => {
          onSelect();
          if (images.length === 0) inputRef.current?.click();
        }}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-border-strong bg-surface-2 text-text-secondary hover:border-accent hover:text-accent"
      >
        {images[0] ? (
          <img src={images[0]} alt="Style" className="h-full w-full object-cover" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
        {images.length > 1 && (
          <span className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-white">
            +{images.length - 1}
          </span>
        )}
        {selected && (
          <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </button>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-text-primary">Autre</span>
        <button
          onClick={() => inputRef.current?.click()}
          aria-label="Ajouter des images"
          className="rounded-md p-0.5 text-text-muted hover:text-accent"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>
      </div>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {images.map((image, index) => (
            <div key={index} className="relative h-6 w-6 overflow-hidden rounded border border-border">
              <img src={image} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => onRemove(index)}
                aria-label="Retirer"
                className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BeforeArea({
  baseImage,
  onImport,
}: {
  baseImage: string | null;
  onImport: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (baseImage) {
    return (
      <button
        onClick={() => inputRef.current?.click()}
        className="flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[12px] bg-stage"
        title="Remplacer l'image"
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
        <img src={baseImage} alt="Personnage de base" className="max-h-full max-w-full object-contain" />
      </button>
    );
  }

  return (
    <div
      className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border-strong bg-surface-3/40 p-6 text-center"
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
      <ImageIcon className="h-9 w-9 text-text-muted" />
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
      >
        <Upload className="h-4 w-4" />
        Importer le personnage de base
      </button>
      <p className="text-[12px] text-text-muted">ou glisse-dépose une image ici</p>
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
        <p className="text-[14px] font-bold text-text-primary">Transfert en cours</p>
        <p className="mt-1 text-[12px] text-text-muted">Re-rendu du personnage dans le style choisi…</p>
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
