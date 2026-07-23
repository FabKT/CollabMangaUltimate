import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/cma/Layout";
import { loadSession, saveSession } from "@/lib/manga-session";
import { MANGA_STYLES } from "@/lib/manga-styles";
import type { SketchFinalResult } from "@/server-functions/sketch-final-image";
import { hasPendingGeneration, resumeDurableGeneration, runDurableGeneration } from "@/lib/durable-generation";
import { notifyCreditsChanged } from "@/lib/credits-events";
import { recordGeneratedImage } from "@/lib/manga-history";
import {
  Check,
  Download,
  FileText,
  ImageIcon,
  PenLine,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/ai/sketch-final")({
  head: () => ({ meta: [{ title: "Raw to Final - CollabManga AI" }] }),
  component: SketchFinalPage,
});

type SketchTab = "raw" | "prompt";

type SketchFinalSnapshot = {
  tab?: SketchTab;
  sketchImage?: string | null;
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
  const { t } = useI18n();
  const [tab, setTab] = useState<SketchTab>("raw");
  const [sketchImage, setSketchImage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<SketchFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadSession<SketchFinalSnapshot>("sketch-final").then((snap) => {
      if (snap) {
        setTab(snap.tab === "prompt" ? "prompt" : "raw");
        setSketchImage(snap.sketchImage ?? null);
        setNotes(snap.notes ?? "");
        if (snap.result) setResult(snap.result);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!hasPendingGeneration("sketch-final")) return;
    setIsGenerating(true);
    void resumeDurableGeneration<SketchFinalResult>("sketch-final").then((generated) => {
      if (generated) setResult(generated);
    }).catch((err) => setError(err instanceof Error ? err.message : t("ai.sketchFinishingFailed")))
      .finally(() => setIsGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSession<SketchFinalSnapshot>("sketch-final", {
      tab,
      sketchImage,
      notes,
      result,
    });
  }, [loaded, tab, sketchImage, notes, result]);

  const activeStyle = MANGA_STYLES.find((style) => style.id === DEFAULT_STYLE_ID) ?? MANGA_STYLES[0];
  const canGenerate = Boolean(sketchImage);

  const importSketch = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    setSketchImage(await fileToDataUrl(file));
    setResult(null);
  };

  const generate = async () => {
    if (!sketchImage) {
      setTab("raw");
      setError(t("ai.importRawFirst"));
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      const styleImageDataUrl = await imageSourceToDataUrl(activeStyle?.face);
      if (!styleImageDataUrl) {
        throw new Error(t("ai.defaultStyleUnavailable"));
      }

      const size = await getImageSizeForGeneration(sketchImage);
      const generated = await runDurableGeneration<SketchFinalResult>(
        "sketch-final",
        "/api/sketch-final/generate",
        {
          sketchImageDataUrl: sketchImage,
          styleImageDataUrl,
          styleId: activeStyle?.id ?? "custom",
          styleName: activeStyle?.name ?? "Style final",
          styleDescription: activeStyle?.description ?? "",
          elementReferences: [],
          notes: notes.trim(),
          size,
        },
      );
      setResult(generated);
      void recordGeneratedImage({
        source: "Raw to Final",
        title: "Image finalisee",
        prompt: notes,
        result: generated,
        editContext: {
          originalImageUrl: generated.imageUrl,
          currentImageUrl: generated.imageUrl,
          prompt: "",
          selectedCharacterIds: [],
          references: [
            { id: "raw-source", name: "Raw", imageDataUrl: sketchImage, role: "Storyboard" as const },
            { id: `${activeStyle?.id ?? "default"}-style`, name: activeStyle?.name ?? "Style", imageDataUrl: styleImageDataUrl, role: "Style" as const },
          ],
          aspectRatio: size === "1536x1024" ? "3:2" : "2:3",
          source: "Raw to Final",
        },
      });
      notifyCreditsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.sketchFinishingFailed"));
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
        title="Raw to Final"
        description={t("ai.sketchFinalDesc")}
        actions={
          <button
            onClick={generate}
            disabled={isGenerating || !canGenerate}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {isGenerating ? t("ai.generatingEllipsis") : t("ai.generateImage")}
          </button>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(330px,420px)_minmax(0,1fr)]">
        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <div className="flex items-center gap-1 border-b border-border p-3">
            {(
              [
                { id: "raw", label: "Raw", icon: PenLine },
                { id: "prompt", label: t("ai.promptTab"), icon: FileText },
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
            {tab === "raw" && (
              <div className="flex flex-col gap-3">
                <SectionIntro
                  title={t("ai.rawImageTitle")}
                  text={t("ai.rawImageIntroText")}
                />
                <UploadPreview
                  image={sketchImage}
                  title={t("ai.importRawImage")}
                  emptyText={t("ai.dragRawImageHere")}
                  onImport={importSketch}
                  onRemove={() => {
                    setSketchImage(null);
                    setResult(null);
                  }}
                />
              </div>
            )}

            {tab === "prompt" && (
              <div className="flex flex-col gap-3">
                <SectionIntro
                  title={t("ai.optionalInstructions")}
                  text={t("ai.optionalInstructionsText")}
                />
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={10}
                  placeholder={t("ai.sketchNotesPlaceholder")}
                  className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <GenerationChecklist
                  hasSketch={Boolean(sketchImage)}
                />
                <button
                  onClick={generate}
                  disabled={isGenerating || !canGenerate}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wand2 className="h-4 w-4" />
                  {isGenerating ? t("ai.generatingEllipsis") : t("ai.generateFinalImage")}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <h2 className="truncate font-display text-base font-bold">{t("ai.finalImageTitle")}</h2>
            </div>
            <button
              onClick={download}
              disabled={!result}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t("ai.download")}
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
                  title={t("ai.viewFullSize")}
                >
                  <img src={result.imageUrl} alt={t("ai.finalRenderAlt")} className="max-h-full max-w-full object-contain" />
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-8 text-center text-text-muted">
                  <Sparkles className="h-8 w-8" />
                  <p className="text-[13px] font-semibold">{t("ai.finalRenderWillAppear")}</p>
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
              aria-label={t("ai.close")}
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={result.imageUrl}
              alt={t("ai.finalRenderAlt")}
              className="w-full rounded-[14px] object-contain"
              style={{ maxHeight: "82vh" }}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={download}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
              >
                <Download className="h-4 w-4" />
                {t("ai.download")}
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
  const { t } = useI18n();
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
            title={t("ai.replaceImageTitle")}
          >
            <img src={image} alt={title} className="max-h-[360px] max-w-full object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface-2 text-[12px] font-bold text-text-secondary hover:border-accent hover:text-accent"
            >
              <Upload className="h-4 w-4" />
              {t("ai.replace")}
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                aria-label={t("ai.remove")}
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

function GenerationChecklist({
  hasSketch,
}: {
  hasSketch: boolean;
}) {
  const { t } = useI18n();
  const items = [
    { label: t("ai.rawImageImported"), done: hasSketch },
    { label: t("ai.outputFramingPreserved"), done: hasSketch },
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
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 text-center text-text-secondary">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-border" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-accent" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 animate-pulse text-accent" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-text-primary">{t("ai.finalizingInProgress")}</p>
        <p className="mt-1 text-[12px] text-text-muted">{t("ai.sketchCleanedRendered")}</p>
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
