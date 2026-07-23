import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Download,
  FileImage,
  FileText,
  ImageIcon,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/cma/Layout";
import { createId, loadCharacterProfiles, type MangaCharacterProfile } from "@/lib/manga-workspace";
import { loadSession, saveSession } from "@/lib/manga-session";
import { hasPendingGeneration, resumeDurableGeneration, runDurableGeneration } from "@/lib/durable-generation";
import { notifyCreditsChanged } from "@/lib/credits-events";
import { recordGeneratedImage } from "@/lib/manga-history";
import type { SwapImageResult } from "@/server-functions/swap-image";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/ai/swap")({
  head: () => ({ meta: [{ title: "Swap - CollabManga AI" }] }),
  component: SwapPage,
});

type SwapTab = "page" | "characters" | "prompt";
// L'original peut venir de la bibliothèque (originalId) OU d'une image importée
// (originalImage) : le personnage présent sur la planche n'est pas forcément
// enregistré dans la bibliothèque. Le remplaçant reste un personnage de la
// bibliothèque (il a besoin de ses références/carte).
type SwapPair = {
  id: string;
  originalId: string;
  originalImage: string | null;
  replacementId: string;
};
type SwapSnapshot = {
  tab?: SwapTab;
  pageImage?: string | null;
  pageAspect?: "2:3" | "3:2";
  pairs?: SwapPair[];
  prompt?: string;
  result?: SwapImageResult | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

function newPair(): SwapPair {
  return { id: createId("swap-pair"), originalId: "", originalImage: null, replacementId: "" };
}

function dataUrlMime(dataUrl: string): string {
  return /^data:([^;]+);/.exec(dataUrl)?.[1] ?? "image/png";
}

function getAspectRatio(src: string): Promise<"2:3" | "3:2"> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth >= image.naturalHeight ? "3:2" : "2:3");
    image.onerror = () => resolve("2:3");
    image.src = src;
  });
}

function profilePreview(profile?: MangaCharacterProfile) {
  if (!profile) return null;
  if (profile.cardImageDataUrl && profile.cardEnabled !== false) return profile.cardImageDataUrl;
  return profile.images?.find((image) => image.enabled !== false)?.imageDataUrl ?? null;
}

function profileText(profile: MangaCharacterProfile) {
  return [
    profile.identityLock,
    profile.storyRole && `Narrative role: ${profile.storyRole}`,
    profile.age && `Age: ${profile.age}`,
    profile.height && `Height: ${profile.height}`,
    profile.bodyProportions && `Body: ${profile.bodyProportions}`,
    profile.outfit && `Outfit: ${profile.outfit}`,
    profile.accessories && `Accessories: ${profile.accessories}`,
    profile.colorNotes && `Colors: ${profile.colorNotes}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

function profileReferences(profile: MangaCharacterProfile) {
  const references = [];
  if (profile.cardImageDataUrl && profile.cardEnabled !== false) {
    references.push({
      id: `${profile.id}-card`,
      name: `${profile.name} - character card`,
      imageDataUrl: profile.cardImageDataUrl,
      mimeType: "image/png",
      view: "Character card",
      description: profile.identityLock,
    });
  }
  for (const image of profile.images ?? []) {
    if (image.enabled === false || !image.imageDataUrl) continue;
    references.push({
      id: image.id,
      name: image.name,
      imageDataUrl: image.imageDataUrl,
      mimeType: image.mimeType,
      view: image.view,
      description: image.notes,
    });
  }
  return references;
}

function SwapPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<SwapTab>("page");
  const [pageImage, setPageImage] = useState<string | null>(null);
  // Ratio de la planche : les cadres (import + résultat) gardent une taille fixe
  // basée dessus ; l'image est recadrée (object-cover) au cadre de base.
  const [pageAspect, setPageAspect] = useState<"2:3" | "3:2">("2:3");
  const [characters, setCharacters] = useState<MangaCharacterProfile[]>([]);
  const [pairs, setPairs] = useState<SwapPair[]>([
    newPair(),
  ]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<SwapImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadCharacterProfiles(), loadSession<SwapSnapshot>("swap")]).then(
      ([savedCharacters, snapshot]) => {
      if (cancelled) return;
      setCharacters(savedCharacters);
      if (snapshot) {
        setTab(snapshot.tab ?? "page");
        setPageImage(snapshot.pageImage ?? null);
        setPageAspect(snapshot.pageAspect === "3:2" ? "3:2" : "2:3");
        setPairs(
          snapshot.pairs?.length
            ? snapshot.pairs.map((pair) => ({ ...newPair(), ...pair }))
            : [newPair()],
        );
        setPrompt(snapshot.prompt ?? "");
        setResult(snapshot.result ?? null);
      }
      setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasPendingGeneration("swap")) return;
    setIsGenerating(true);
    void resumeDurableGeneration<SwapImageResult>("swap").then((generated) => {
      if (generated) setResult(generated);
    }).catch((err) => setError(err instanceof Error ? err.message : t("ai.characterSwapFailed")))
      .finally(() => setIsGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSession<SwapSnapshot>("swap", {
      tab,
      pageImage,
      pageAspect,
      pairs,
      prompt,
      result,
    });
  }, [loaded, tab, pageImage, pageAspect, pairs, prompt, result]);

  const characterMap = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );
  const validPairs = useMemo(
    () =>
      pairs.filter((pair) => {
        const replacement = characterMap.get(pair.replacementId);
        if (!replacement || profileReferences(replacement).length === 0) return false;
        // Original : soit une image importée, soit un personnage de la bibliothèque.
        if (pair.originalImage) return true;
        const original = characterMap.get(pair.originalId);
        return Boolean(
          original &&
            original.id !== replacement.id &&
            profileReferences(original).length > 0,
        );
      }),
    [characterMap, pairs],
  );
  const canGenerate = Boolean(pageImage && validPairs.length === pairs.length && pairs.length > 0);
  const pageAspectCss = pageAspect === "3:2" ? "3 / 2" : "2 / 3";

  const importPage = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPageImage(dataUrl);
    setPageAspect(await getAspectRatio(dataUrl));
    setResult(null);
    setError(null);
  };

  const updatePair = (id: string, patch: Partial<SwapPair>) => {
    setPairs((current) => current.map((pair) => (pair.id === id ? { ...pair, ...patch } : pair)));
    setResult(null);
  };

  const importOriginal = async (id: string, files: FileList | null) => {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    // Une image importée prime : on efface la sélection bibliothèque de l'original.
    updatePair(id, { originalImage: dataUrl, originalId: "" });
  };

  const generate = async () => {
    if (!pageImage) {
      setTab("page");
      setError(t("ai.importPageFirst"));
      return;
    }
    if (!canGenerate) {
      setTab("characters");
      setError(t("ai.completeEachPair"));
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      const aspectRatio = await getAspectRatio(pageImage);
      const payloadPairs = validPairs.map((pair, index) => {
        const replacement = characterMap.get(pair.replacementId)!;
        // Original importé : une seule référence image suffit à l'identifier.
        const original = pair.originalImage
          ? {
              id: `original-${pair.id}`,
              name: `Original ${index + 1}`,
              profile: "",
              references: [
                {
                  id: `original-${pair.id}-image`,
                  name: `Original ${index + 1} - imported reference`,
                  imageDataUrl: pair.originalImage,
                  mimeType: dataUrlMime(pair.originalImage),
                  view: "Imported reference",
                  description: "",
                },
              ],
            }
          : (() => {
              const profile = characterMap.get(pair.originalId)!;
              return {
                id: profile.id,
                name: profile.name,
                profile: profileText(profile),
                references: profileReferences(profile),
              };
            })();
        return {
          id: pair.id,
          original,
          replacement: {
            id: replacement.id,
            name: replacement.name,
            profile: profileText(replacement),
            references: profileReferences(replacement),
          },
        };
      });
      const generated = await runDurableGeneration<SwapImageResult>(
        "swap",
        "/api/swap/generate",
        {
          pageImageDataUrl: pageImage,
          pairs: payloadPairs,
          prompt,
          aspectRatio,
        },
      );
      setResult(generated);
      void recordGeneratedImage({
        source: "Swap",
        title: "Echange de personnages",
        prompt,
        result: generated,
        editContext: {
          originalImageUrl: generated.imageUrl,
          currentImageUrl: generated.imageUrl,
          prompt: "",
          selectedCharacterIds: Array.from(new Set(validPairs.flatMap((pair) => [pair.originalId, pair.replacementId]).filter(Boolean))),
          references: [{ id: "swap-source", name: t("ai.sourcePage"), imageDataUrl: pageImage, role: "Target" as const }],
          aspectRatio,
          source: "Swap",
        },
      });
      notifyCreditsChanged();
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : t("ai.characterSwapFailed"),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const download = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `collabmanga-swap-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader
        title="Swap"
        description={t("ai.swapDesc")}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="shadow-panel flex min-h-[680px] min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <div className="flex items-center gap-1 border-b border-border p-3">
            {(
              [
                { id: "page", label: t("ai.pageTab"), icon: FileImage },
                { id: "characters", label: t("ai.charactersTab"), icon: Users },
                { id: "prompt", label: t("ai.promptTab"), icon: FileText },
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
                <entry.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{entry.label}</span>
              </button>
            ))}
          </div>

          <div className="scroll-dark min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "page" && (
              <PageUploader
                image={pageImage}
                aspect={pageAspectCss}
                onImport={importPage}
                onRemove={() => setPageImage(null)}
              />
            )}

            {tab === "characters" && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-2 px-1 text-center text-[11px] font-extrabold uppercase text-text-muted">
                  <span>{t("ai.originalLabel")}</span>
                  <span />
                  <span>{t("ai.replacementLabel")}</span>
                </div>
                {pairs.map((pair) => (
                  <SwapPairRow
                    key={pair.id}
                    pair={pair}
                    characters={characters}
                    onChange={(patch) => updatePair(pair.id, patch)}
                    onImportOriginal={(files) => importOriginal(pair.id, files)}
                    onRemove={
                      pairs.length > 1
                        ? () => setPairs((current) => current.filter((item) => item.id !== pair.id))
                        : undefined
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setPairs((current) => [
                      ...current,
                      newPair(),
                    ])
                  }
                  className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong bg-surface-3 text-[13px] font-bold text-text-secondary hover:border-accent hover:text-accent"
                >
                  <Plus className="h-4 w-4" />
                  {t("ai.addSwap")}
                </button>
                {!characters.length && (
                  <Link
                    to="/ai/characters"
                    className="rounded-[12px] border border-border bg-surface-3 p-4 text-center text-[13px] font-bold text-accent"
                  >
                    {t("ai.createCharactersInLibrary")}
                  </Link>
                )}
              </div>
            )}

            {tab === "prompt" && (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] font-bold">{t("ai.optionalInstructions")}</p>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={14}
                  placeholder={t("ai.swapPromptPlaceholder")}
                  className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            {error && <p className="mb-3 text-[12px] font-semibold text-danger">{error}</p>}
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate || isGenerating}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-extrabold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              {isGenerating ? t("ai.generatingEllipsis") : t("ai.generateSwap")}
            </button>
          </div>
        </section>

        <section className="shadow-panel flex min-h-[680px] min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex h-[65px] items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-bold">{t("ai.generatedImageFallback")}</h2>
            </div>
            <button
              type="button"
              onClick={download}
              disabled={!result}
              aria-label={t("ai.download")}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-3 text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
            </button>
          </header>
          <div className="p-4">
            {/* Cadre de taille fixe (ratio de la planche) : l'image générée est
                recadrée dedans (object-cover), l'emplacement ne bouge plus. */}
            <div
              className="w-full overflow-hidden rounded-[12px] bg-stage"
              style={{ aspectRatio: pageAspectCss }}
            >
              {isGenerating ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-text-secondary">
                  <Sparkles className="h-8 w-8 animate-pulse text-accent" />
                  <p className="text-[13px] font-semibold">{t("ai.replacingCharacters")}</p>
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
                    alt={t("ai.swappedPageAlt")}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center text-text-muted">
                  <ImageIcon className="h-9 w-9" />
                  <p className="text-[13px] font-semibold">{t("ai.modifiedPageWillAppear")}</p>
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
              aria-label={t("ai.close")}
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={result.imageUrl}
              alt={t("ai.swappedPageAlt")}
              className="max-h-[88vh] max-w-full rounded-[14px] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PageUploader({
  image,
  aspect,
  onImport,
  onRemove,
}: {
  image: string | null;
  aspect: string;
  onImport: (files: FileList | null) => void;
  onRemove: () => void;
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
            className="w-full overflow-hidden rounded-[12px] bg-stage"
            style={{ aspectRatio: aspect }}
          >
            {/* Planche recadrée au cadre de base (object-cover). */}
            <img src={image} alt={t("ai.sourcePage")} className="h-full w-full object-cover" />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface-2 text-[12px] font-bold"
            >
              <Upload className="h-4 w-4" /> {t("ai.replace")}
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={t("ai.remove")}
              className="grid h-10 w-10 place-items-center rounded-[10px] border border-border bg-surface-2 text-text-muted hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border-strong bg-surface-2 hover:border-accent"
          style={{ aspectRatio: aspect }}
        >
          <Upload className="h-9 w-9 text-text-muted" />
          <span className="text-[14px] font-bold">{t("ai.importThePage")}</span>
        </button>
      )}
    </div>
  );
}

function SwapPairRow({
  pair,
  characters,
  onChange,
  onImportOriginal,
  onRemove,
}: {
  pair: SwapPair;
  characters: MangaCharacterProfile[];
  onChange: (patch: Partial<SwapPair>) => void;
  onImportOriginal: (files: FileList | null) => void;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-2 rounded-[14px] border border-border bg-surface-3 p-3">
      <OriginalPicker
        pair={pair}
        characters={characters}
        onChange={onChange}
        onImport={onImportOriginal}
      />
      <div className="grid place-items-center">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-accent/40 bg-accent-soft text-accent">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      <CharacterSelector
        value={pair.replacementId}
        characters={characters}
        excludedId={pair.originalId}
        onChange={(replacementId) => onChange({ replacementId })}
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("ai.removeThisSwap")}
          className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-border bg-surface-2 text-text-muted hover:text-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function OriginalPicker({
  pair,
  characters,
  onChange,
  onImport,
}: {
  pair: SwapPair;
  characters: MangaCharacterProfile[];
  onChange: (patch: Partial<SwapPair>) => void;
  onImport: (files: FileList | null) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const profile = characters.find((character) => character.id === pair.originalId);
  const preview = pair.originalImage ?? profilePreview(profile);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[10px] border border-border bg-stage">
        {preview ? (
          <img src={preview} alt={profile?.name ?? t("ai.originalCharacterFallback")} className="h-full w-full object-cover" />
        ) : (
          <Users className="h-7 w-7 text-text-muted" />
        )}
        {pair.originalImage && (
          <button
            type="button"
            onClick={() => onChange({ originalImage: null })}
            aria-label={t("ai.removeImportedImage")}
            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border border-border bg-surface-2 text-text-muted hover:text-danger"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
      {pair.originalImage ? (
        <div className="flex h-10 items-center justify-center rounded-[10px] border border-accent/40 bg-accent-soft px-2 text-[12px] font-bold text-accent">
          {t("ai.importedImageBadge")}
        </div>
      ) : (
        <>
          <select
            value={pair.originalId}
            onChange={(event) => onChange({ originalId: event.target.value })}
            className="h-10 min-w-0 w-full rounded-[10px] border border-border bg-input px-2 text-[12px] font-bold text-text-primary outline-none focus:border-accent"
          >
            <option value="">{t("ai.selectWord")}</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id} disabled={character.id === pair.replacementId}>
                {character.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-strong bg-surface-2 text-[11px] font-bold text-text-secondary hover:border-accent hover:text-accent"
          >
            <Upload className="h-3.5 w-3.5" /> {t("ai.importAnImage")}
          </button>
        </>
      )}
    </div>
  );
}

function CharacterSelector({
  value,
  characters,
  excludedId,
  onChange,
}: {
  value: string;
  characters: MangaCharacterProfile[];
  excludedId: string;
  onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const profile = characters.find((character) => character.id === value);
  const preview = profilePreview(profile);
  return (
    <label className="flex min-w-0 cursor-pointer flex-col gap-2">
      <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[10px] border border-border bg-stage">
        {preview ? (
          <img
            src={preview}
            alt={profile?.name ?? t("ai.characterFallback")}
            className="h-full w-full object-cover"
          />
        ) : (
          <Users className="h-7 w-7 text-text-muted" />
        )}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 w-full rounded-[10px] border border-border bg-input px-2 text-[12px] font-bold text-text-primary outline-none focus:border-accent"
      >
        <option value="">{t("ai.selectWord")}</option>
        {characters.map((character) => (
          <option key={character.id} value={character.id} disabled={character.id === excludedId}>
            {character.name}
          </option>
        ))}
      </select>
    </label>
  );
}
