import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/cma/Layout";
import { loadSession, saveSession } from "@/lib/manga-session";
import { MANGA_STYLES } from "@/lib/manga-styles";
import { loadCustomMangaStyles, type CustomMangaStyle } from "@/lib/custom-manga-styles";
import { CustomStyleModal } from "@/components/cma/CustomStyleModal";
import type { StyleTransferResult } from "@/server-functions/style-transfer-image";
import {
  hasPendingGeneration,
  resumeDurableGeneration,
  runDurableGeneration,
} from "@/lib/durable-generation";
import { notifyCreditsChanged } from "@/lib/credits-events";
import { recordGeneratedImage } from "@/lib/manga-history";
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
  Layers,
  User,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/ai/style-transfer")({
  head: () => ({ meta: [{ title: "Transfert de style — CollabManga AI" }] }),
  component: StyleTransferPage,
});

/* ---------------- Modes (onglets) ---------------- */

type TransferMode = "planche" | "personnage";

type ModeConfig = {
  label: string;
  icon: typeof Layers;
  endpoint: string;
  baseBadge: string;
  baseTitle: string;
  importCta: string;
  resultTitle: string;
  resultEmpty: string;
};

function modeConfig(t: (key: TranslationKey) => string): Record<TransferMode, ModeConfig> {
  return {
    planche: {
      label: t("ai.styleTransferModePlanche"),
      icon: Layers,
      endpoint: "/api/planche-transfer/generate",
      baseBadge: t("ai.beforeBadge"),
      baseTitle: t("ai.baseTitlePlanche"),
      importCta: t("ai.importBasePlanche"),
      resultTitle: t("ai.resultTitlePlanche"),
      resultEmpty: t("ai.resultEmptyPlanche"),
    },
    personnage: {
      label: t("ai.styleTransferModePersonnage"),
      icon: User,
      endpoint: "/api/style-transfer/generate",
      baseBadge: t("ai.beforeBadge"),
      baseTitle: t("ai.baseTitlePersonnage"),
      importCta: t("ai.importBasePersonnage"),
      resultTitle: t("ai.resultTitlePersonnage"),
      resultEmpty: t("ai.resultEmptyPersonnage"),
    },
  };
}

const MODES: TransferMode[] = ["planche", "personnage"];

type StyleTransferSnapshot = {
  mode?: TransferMode;
  targetStyleId?: string;
  baseImages?: Partial<Record<TransferMode, string | null>>;
  results?: Partial<Record<TransferMode, StyleTransferResult | null>>;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        if (scale >= 1 && file.size < 1_800_000) {
          resolve(rawDataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(rawDataUrl);
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      image.onerror = () => resolve(rawDataUrl);
      image.src = rawDataUrl;
    };
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

async function imageSourceToDataUrl(src?: string) {
  if (!src) return undefined;
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("Unable to load the selected style reference.");
  return fileToDataUrl(new File([await response.blob()], "style-reference.png"));
}

function imageAspectRatio(src: string): Promise<"2:3" | "3:2"> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth >= image.naturalHeight ? "3:2" : "2:3");
    image.onerror = () => resolve("2:3");
    image.src = src;
  });
}

function StyleTransferPage() {
  const { t } = useI18n();
  const MODE_CONFIG = useMemo(() => modeConfig(t), [t]);
  const [mode, setMode] = useState<TransferMode>("personnage");
  const [targetStyleId, setTargetStyleId] = useState<string>(MANGA_STYLES[0].id);
  const [customStyles, setCustomStyles] = useState<CustomMangaStyle[]>([]);
  const [createStyleOpen, setCreateStyleOpen] = useState(false);
  const [baseImages, setBaseImages] = useState<Record<TransferMode, string | null>>({
    planche: null,
    personnage: null,
  });
  const [results, setResults] = useState<Record<TransferMode, StyleTransferResult | null>>({
    planche: null,
    personnage: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadSession<StyleTransferSnapshot>("style-transfer").then((snap) => {
      if (snap) {
        setMode(snap.mode === "planche" ? "planche" : "personnage");
        setTargetStyleId(snap.targetStyleId ?? MANGA_STYLES[0].id);
        setBaseImages({
          planche: snap.baseImages?.planche ?? null,
          personnage: snap.baseImages?.personnage ?? null,
        });
        setResults({
          planche: snap.results?.planche ?? null,
          personnage: snap.results?.personnage ?? null,
        });
      }
      setLoaded(true);
    });
    void loadCustomMangaStyles().then(setCustomStyles);
  }, []);

  useEffect(() => {
    if (!hasPendingGeneration("style-transfer")) return;
    const pendingMode =
      window.localStorage.getItem("collabmanga.ai-job.style-transfer.mode") === "planche"
        ? "planche"
        : "personnage";
    setIsGenerating(true);
    void resumeDurableGeneration<StyleTransferResult>("style-transfer")
      .then((generated) => {
        if (generated) {
          setResults((current) => ({ ...current, [pendingMode]: generated }));
          window.localStorage.removeItem("collabmanga.ai-job.style-transfer.mode");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("ai.styleTransferFailed")))
      .finally(() => setIsGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSession<StyleTransferSnapshot>("style-transfer", {
      mode,
      targetStyleId,
      baseImages,
      results,
    });
  }, [loaded, mode, targetStyleId, baseImages, results]);

  const cfg = MODE_CONFIG[mode];
  const baseImage = baseImages[mode];
  const result = results[mode];

  const setBaseImage = (value: string | null) =>
    setBaseImages((current) => ({ ...current, [mode]: value }));
  const setResult = (value: StyleTransferResult | null) =>
    setResults((current) => ({ ...current, [mode]: value }));

  const activeCustomStyle = customStyles.find((style) => style.id === targetStyleId);
  const isCustom = Boolean(activeCustomStyle);
  const activeStyle = MANGA_STYLES.find((style) => style.id === targetStyleId);
  const canGenerate = Boolean(baseImage && (activeStyle || activeCustomStyle));

  const importBase = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setBaseImage(await fileToDataUrl(file));
  };

  const generate = async () => {
    if (!canGenerate || !baseImage) return;
    setError(null);
    setIsGenerating(true);
    try {
      const presetStyleReferences = activeStyle
        ? [await imageSourceToDataUrl(activeStyle.face)].filter((image): image is string =>
            Boolean(image),
          )
        : [];
      const styleReferenceImages = activeCustomStyle?.images ?? presetStyleReferences;
      const aspectRatio = await imageAspectRatio(baseImage);
      window.localStorage.setItem("collabmanga.ai-job.style-transfer.mode", mode);
      const generated = await runDurableGeneration<StyleTransferResult>(
        "style-transfer",
        cfg.endpoint,
        {
          baseImageDataUrl: baseImage,
          styleId: targetStyleId,
          styleName: activeCustomStyle?.name ?? activeStyle?.name ?? "",
          styleDescription: isCustom ? "" : (activeStyle?.description ?? ""),
          customStyleImages: styleReferenceImages,
          aspectRatio,
        },
      );
      setResult(generated);
      window.localStorage.removeItem("collabmanga.ai-job.style-transfer.mode");
      void recordGeneratedImage({
        source: "Transfert de style",
        title: cfg.resultTitle,
        prompt: `Style: ${activeCustomStyle?.name ?? activeStyle?.name ?? "personnalise"}`,
        result: generated,
        editContext: {
          originalImageUrl: generated.imageUrl,
          currentImageUrl: generated.imageUrl,
          prompt: "",
          selectedCharacterIds: [],
          references: [
            {
              id: `${mode}-source`,
              name: t("ai.sourceImageName"),
              imageDataUrl: baseImage,
              role: "Inspiration" as const,
            },
            ...styleReferenceImages.map((imageDataUrl, index) => ({
              id: `${targetStyleId}-${index}`,
              name: `${activeCustomStyle?.name ?? activeStyle?.name ?? "Style"} ${index + 1}`,
              imageDataUrl,
              role: "Style" as const,
            })),
          ],
          aspectRatio: generated.size === "1536x1024" ? "3:2" : "2:3",
          source: "Transfert de style",
        },
      });
      notifyCreditsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.styleTransferFailed"));
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

  const switchMode = (next: TransferMode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setIsGenerating(false);
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader title={t("ai.styleTransfer")} description={t("ai.styleTransferDesc")} />

      {/* Onglets : Planche / Personnage */}
      <div className="mb-3 inline-flex shrink-0 self-start items-center gap-1 rounded-[14px] border border-border bg-surface-2 p-1 md:mb-4">
        {MODES.map((id) => {
          const entry = MODE_CONFIG[id];
          const active = id === mode;
          const Icon = entry.icon;
          return (
            <button
              key={id}
              onClick={() => switchMode(id)}
              className={`inline-flex h-[38px] items-center gap-2 rounded-[10px] px-4 text-[13px] font-bold transition ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* Compact style band leaves the available height to the source/result frames. */}
      <section className="shadow-panel mb-2 shrink-0 rounded-[16px] border border-border bg-surface-2 p-2 md:mb-3">
        <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
          {t("ai.targetStyle")}
        </div>
        <div className="scroll-dark flex gap-2 overflow-x-auto pb-1">
          {MANGA_STYLES.map((style) => {
            const selected = style.id === targetStyleId;
            return (
              <button
                key={style.id}
                onClick={() => setTargetStyleId(style.id)}
                className={`flex w-[88px] shrink-0 flex-col gap-1.5 rounded-[12px] border p-1.5 transition ${
                  selected
                    ? "border-accent-border bg-accent-soft/30"
                    : "border-border bg-surface-3 hover:border-accent"
                }`}
              >
                <div className="relative h-12 w-full overflow-hidden rounded-[8px] border border-border bg-surface-2">
                  <img
                    src={style.face}
                    alt={style.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {selected && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <span className="truncate text-center text-[11px] font-bold text-text-primary">
                  {style.name}
                </span>
              </button>
            );
          })}

          {customStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => setTargetStyleId(style.id)}
              className={`flex w-[88px] shrink-0 flex-col gap-1.5 rounded-[12px] border p-1.5 transition ${
                style.id === targetStyleId
                  ? "border-accent-border bg-accent-soft/30"
                  : "border-border bg-surface-3 hover:border-accent"
              }`}
            >
              <div className="relative h-12 w-full overflow-hidden rounded-[8px] border border-border bg-surface-2">
                <img
                  src={style.images[0]}
                  alt={style.name}
                  className="h-full w-full object-cover"
                />
                {style.id === targetStyleId && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <span className="truncate text-center text-[11px] font-bold text-text-primary">
                {style.name}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreateStyleOpen(true)}
            className="flex w-[88px] shrink-0 flex-col gap-1.5 rounded-[12px] border border-dashed border-border-strong bg-surface-3 p-1.5 transition hover:border-accent"
          >
            <span className="grid h-12 w-full place-items-center rounded-[8px] border border-dashed border-border-strong bg-surface-2 text-text-secondary">
              <Plus className="h-5 w-5" />
            </span>
            <span className="truncate text-center text-[11px] font-bold text-text-primary">
              {t("ai.createStyle")}
            </span>
          </button>
        </div>
      </section>

      {/* Before / After — two equal parts */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        {/* Before */}
        <section className="shadow-panel flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-border bg-surface-2">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-2.5 md:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                {cfg.baseBadge}
              </span>
              <h2 className="truncate font-display text-sm font-bold md:text-base">
                {cfg.baseTitle}
              </h2>
            </div>
            {baseImage && (
              <button
                onClick={() => setBaseImage(null)}
                aria-label={t("ai.remove")}
                className="rounded-md p-1 text-text-muted hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </header>
          <div className="aspect-square w-full p-2.5 md:p-4">
            <BeforeArea baseImage={baseImage} importCta={cfg.importCta} onImport={importBase} />
          </div>
        </section>

        {/* After */}
        <section className="shadow-panel flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-border bg-surface-2">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-2.5 md:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="truncate font-display text-sm font-bold md:text-base">
                {cfg.resultTitle}
              </h2>
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
          <div className="aspect-square w-full p-2.5 md:p-4">
            {/* Cadre fixe, résultat entier affiché sans déformation. */}
            <div className="h-full w-full overflow-hidden rounded-[12px] bg-stage">
              {isGenerating ? (
                <div className="flex h-full w-full items-center justify-center">
                  <GeneratingIndicator />
                </div>
              ) : error ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-8 text-center text-text-secondary">
                  <X className="mb-3 h-8 w-8 text-danger" />
                  <p className="text-[13px] font-semibold">{error}</p>
                </div>
              ) : result ? (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="h-full w-full cursor-zoom-in"
                  title={t("ai.viewFullSize")}
                >
                  <img
                    src={result.imageUrl}
                    alt={cfg.resultTitle}
                    className="h-full w-full object-contain"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-8 text-center text-text-muted">
                  <Sparkles className="h-8 w-8" />
                  <p className="text-[13px] font-semibold">{cfg.resultEmpty}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={isGenerating || !canGenerate}
        className="mt-3 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-accent px-5 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 md:mt-4"
      >
        <Wand2 className="h-4 w-4" />
        {isGenerating ? t("ai.transferringEllipsis") : t("ai.transferStyle")}
      </button>

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
              aria-label={t("ai.close")}
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={result.imageUrl}
              alt={cfg.resultTitle}
              className="w-full rounded-[14px] object-contain"
              style={{ maxHeight: "82vh" }}
            />
          </div>
        </div>
      )}
      <CustomStyleModal
        open={createStyleOpen}
        onClose={() => setCreateStyleOpen(false)}
        onSaved={(style) => {
          setCustomStyles((current) => [style, ...current]);
          setTargetStyleId(style.id);
        }}
      />
    </div>
  );
}

function BeforeArea({
  baseImage,
  importCta,
  onImport,
}: {
  baseImage: string | null;
  importCta: string;
  onImport: (files: FileList | null) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (baseImage) {
    return (
      <button
        onClick={() => inputRef.current?.click()}
        className="h-full w-full overflow-hidden rounded-[12px] bg-stage"
        title={t("ai.replaceImageTitle")}
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
        {/* Cadre fixe, image entière conservée dans son ratio d'origine. */}
        <img src={baseImage} alt={t("ai.baseImageAlt")} className="h-full w-full object-contain" />
      </button>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border-strong bg-surface-3/40 p-3 text-center md:p-6"
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
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] bg-accent px-3 text-[12px] font-bold text-accent-foreground hover:bg-accent-hover md:px-4 md:text-[13px]"
      >
        <Upload className="h-4 w-4" />
        {importCta}
      </button>
      <p className="text-[12px] text-text-muted">{t("ai.orDragDropImageHere")}</p>
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
        <p className="text-[14px] font-bold text-text-primary">{t("ai.transferInProgress")}</p>
        <p className="mt-1 text-[12px] text-text-muted">{t("ai.reRenderingInStyle")}</p>
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
