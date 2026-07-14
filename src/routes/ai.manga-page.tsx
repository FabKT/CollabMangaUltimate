import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type MangaBackendStatusResult,
  type MangaImageGenerationInput,
  type MangaImageGenerationResult,
} from "@/server-functions/manga-image";
import {
  createBlankCharacter,
  createId,
  loadCharacterProfiles,
  saveCharacterProfiles,
  type MangaCharacterImage,
  type MangaCharacterProfile,
} from "@/lib/manga-workspace";
import {
  addHistoryEntry,
  loadHistory,
  removeHistoryEntry,
  type MangaHistoryEntry,
} from "@/lib/manga-history";
import { PlancheCanvas } from "@/components/canvas/PlancheCanvas";
import { loadSession, saveSession } from "@/lib/manga-session";
import {
  BookImage,
  Check,
  ChevronDown,
  Download,
  FileImage,
  History,
  ImageIcon,
  Layers,
  Lightbulb,
  Mountain,
  Package,
  PencilRuler,
  PenTool,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wand2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/ai/manga-page")({
  head: () => ({
    meta: [
      { title: "CollabManga AI - Manga Page Workspace" },
      {
        name: "description",
        content: "AI manga page generation workspace with characters, references, and panels.",
      },
    ],
  }),
  component: CollabMangaAIPage,
});

type Role =
  | "Character"
  | "Background"
  | "Object"
  | "Storyboard"
  | "Pose"
  | "Style"
  | "Inspiration"
  | "Target"
  | "Generated Page";

type CharacterProfile = MangaCharacterProfile;

type StoredItem = {
  id: string;
  name: string;
  role: Role;
  thumbHue: number;
  imageDataUrl?: string;
  mimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  omitFromImageGeneration?: boolean;
  characterId?: string;
  description?: string;
};

type WorkspaceTab = "structure" | "characters" | "references" | "prompt";
type GenerationOperation = MangaImageGenerationInput["operation"];
type AspectRatio = "2:3" | "3:2";

const generatedImageDimensions: Record<AspectRatio, { width: number; height: number; size: string }> = {
  "2:3": { width: 1024, height: 1536, size: "1024x1536" },
  "3:2": { width: 1536, height: 1024, size: "1536x1024" },
};

type MangaSessionSnapshot = {
  items?: StoredItem[];
  selected?: Record<string, boolean>;
  selectedCharacterIds?: Record<string, boolean>;
  activeCharacterId?: string;
  uploadRole?: Role;
  prompt?: string;
  editPrompt?: string;
  editScope?: "single" | "full";
  panelCount?: number;
  panelInstructions?: string[];
  styleMode?: "auto" | "black-white" | "color";
  backgroundLevel?: "auto" | "empty" | "minimal" | "detailed";
  readingDirection?: "right-to-left" | "left-to-right";
  aspectRatio?: AspectRatio;
  tab?: WorkspaceTab;
  showCanvas?: boolean;
  generationResult?: MangaImageGenerationResult | null;
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "Character", label: "Character identity" },
  { value: "Storyboard", label: "Storyboard structure" },
  { value: "Pose", label: "Pose reference" },
  { value: "Style", label: "Style reference" },
  { value: "Inspiration", label: "Inspiration" },
  { value: "Background", label: "Background" },
  { value: "Object", label: "Object" },
  { value: "Target", label: "Image to modify" },
];

function normalizeAspectRatio(value: unknown): AspectRatio {
  if (value === "3:2" || value === "4:3") return "3:2";
  return "2:3";
}

const mangaStatusApiPath = "/api/manga/status";
const mangaGenerateApiPath = "/api/manga/generate-page";
const mangaGenerationTimeoutMs = 16 * 60 * 1000;

type MangaApiErrorPayload = {
  error?: string;
};

async function requestMangaApiJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = (contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { error: await response.text().catch(() => "") }) as T & MangaApiErrorPayload;

    if (!response.ok) {
      throw new Error(payload.error || `Manga API request failed with status ${response.status}.`);
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The image service is still taking too long after several minutes. Try again with fewer reference images.",
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "The local CollabManga API could not be reached. Refresh the page and make sure the local server is still running.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function checkMangaBackendViaApi() {
  return requestMangaApiJson<MangaBackendStatusResult>(
    mangaStatusApiPath,
    { method: "GET" },
    60_000,
  );
}

function generateMangaImageViaApi(data: MangaImageGenerationInput) {
  return requestMangaApiJson<MangaImageGenerationResult>(
    mangaGenerateApiPath,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    mangaGenerationTimeoutMs,
  );
}

function hueFromName(name: string) {
  return Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}

function fileBaseName(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Imported image"
  );
}

function characterImagesToLibraryItems(characters: CharacterProfile[]): StoredItem[] {
  return characters.flatMap((character) =>
    (character.images ?? []).map((image) => ({
      id: `profile-${character.id}-${image.id}`,
      name: `${character.name || "Character"} - ${image.view || image.name}`,
      role: "Character" as const,
      thumbHue: hueFromName(character.name || image.name),
      imageDataUrl: image.imageDataUrl,
      mimeType: image.mimeType,
      characterId: character.id,
      description: image.notes || image.view || "",
    })),
  );
}

function isProfileCharacterItem(item: StoredItem) {
  return item.id.startsWith("profile-");
}

function mergeCharacterImagesIntoItems(items: StoredItem[], characters: CharacterProfile[]) {
  const profileItems = characterImagesToLibraryItems(characters);
  return [...profileItems, ...items.filter((item) => !isProfileCharacterItem(item))];
}

function characterImageItems(character: CharacterProfile, items: StoredItem[]) {
  const profileItems = characterImagesToLibraryItems([character]);
  const profileIds = new Set(profileItems.map((item) => item.id));
  const manualItems = items.filter(
    (item) =>
      item.characterId === character.id &&
      item.imageDataUrl &&
      (!isProfileCharacterItem(item) || !profileIds.has(item.id)),
  );
  return [...profileItems, ...manualItems];
}

function firstCharacterImageItem(character: CharacterProfile, items: StoredItem[]) {
  return characterImageItems(character, items)[0];
}

async function readImageAsDataUrl(file: File) {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });

  return new Promise<{ dataUrl: string; mimeType: string; width?: number; height?: number }>(
    (resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      if (scale >= 1 && file.size < 1_800_000) {
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type || "image/png",
          width: image.width,
          height: image.height,
        });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type || "image/png",
          width: image.width,
          height: image.height,
        });
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", 0.88),
        mimeType: "image/jpeg",
        width: canvas.width,
        height: canvas.height,
      });
    };
    image.onerror = () => resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
    image.src = rawDataUrl;
  });
}

async function normalizeGeneratedImageAspectRatio(imageUrl: string, aspectRatio: AspectRatio) {
  const target = generatedImageDimensions[aspectRatio];

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (!sourceWidth || !sourceHeight) {
        resolve(imageUrl);
        return;
      }

      const targetRatio = target.width / target.height;
      const sourceRatio = sourceWidth / sourceHeight;
      let sx = 0;
      let sy = 0;
      let sw = sourceWidth;
      let sh = sourceHeight;

      if (sourceRatio > targetRatio) {
        sw = sourceHeight * targetRatio;
        sx = (sourceWidth - sw) / 2;
      } else if (sourceRatio < targetRatio) {
        sh = sourceWidth / targetRatio;
        sy = (sourceHeight - sh) / 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(imageUrl);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, target.width, target.height);
      context.drawImage(image, sx, sy, sw, sh, 0, 0, target.width, target.height);

      try {
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(imageUrl);
      }
    };
    image.onerror = () => resolve(imageUrl);
    image.src = imageUrl;
  });
}

function imageDimensionsFromDataUrl(dataUrl: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

function aspectRatioLabelFromDimensions(width: number, height: number) {
  return width >= height ? "landscape" : "portrait";
}

function backendSupportsGeneratedImageSize(
  status: MangaBackendStatusResult,
  aspectRatio: AspectRatio,
) {
  const expectedSize = generatedImageDimensions[aspectRatio].size;
  const supportedSizes = status.manga?.supportedImageSizes ?? [];
  return status.manga?.imageSize === expectedSize || supportedSizes.includes(expectedSize);
}

async function prepareSelectedAssetsForGeneration(
  selectedItems: StoredItem[],
  aspectRatio: AspectRatio,
  supportsBackendAspectGuard: boolean,
) {
  const targetRatio = aspectRatio === "3:2" ? 3 / 2 : 2 / 3;
  const ratioTolerance = 0.18;
  const layoutDominantRoles = new Set<Role>(["Storyboard", "Target", "Inspiration", "Style"]);

  return Promise.all(
    selectedItems.map(async (item) => {
      if (!item.imageDataUrl) return item;

      const dimensions =
        item.imageWidth && item.imageHeight
          ? { width: item.imageWidth, height: item.imageHeight }
          : await imageDimensionsFromDataUrl(item.imageDataUrl);
      if (!dimensions?.width || !dimensions.height) return item;

      const sourceRatio = dimensions.width / dimensions.height;
      const mismatch = Math.abs(sourceRatio - targetRatio) / targetRatio > ratioTolerance;
      if (!mismatch || item.role === "Character" || !layoutDominantRoles.has(item.role)) {
        return { ...item, imageWidth: dimensions.width, imageHeight: dimensions.height };
      }

      const sourceLabel = aspectRatioLabelFromDimensions(dimensions.width, dimensions.height);
      const description = [
        item.description,
        `This reference image is ${sourceLabel} (${dimensions.width}x${dimensions.height}) while final generation format is ${aspectRatio}; extract useful visual facts from it, but do not preserve its canvas shape, page silhouette, outer white margins, or portrait/landscape layout.`,
      ]
        .filter(Boolean)
        .join(" ");

      if (supportsBackendAspectGuard) {
        return {
          ...item,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
          omitFromImageGeneration: false,
          description,
        };
      }

      return {
        ...item,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
        omitFromImageGeneration: false,
        description,
      };
    }),
  );
}

function CollabMangaAIPage() {
  const [tab, setTab] = useState<WorkspaceTab>("structure");
  const [items, setItems] = useState<StoredItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Record<string, boolean>>({});
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [charactersLoaded, setCharactersLoaded] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState("");
  const [uploadRole, setUploadRole] = useState<Role>("Character");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editScope, setEditScope] = useState<"single" | "full">("single");
  const [panelCount, setPanelCount] = useState(6);
  const [panelInstructions, setPanelInstructions] = useState<string[]>(
    Array.from({ length: 6 }, () => ""),
  );
  const [styleMode, setStyleMode] = useState<"auto" | "black-white" | "color">("auto");
  const [backgroundLevel, setBackgroundLevel] = useState<"auto" | "empty" | "minimal" | "detailed">(
    "auto",
  );
  const [readingDirection, setReadingDirection] = useState<"right-to-left" | "left-to-right">(
    "right-to-left",
  );
  const [generationResult, setGenerationResult] = useState<MangaImageGenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<MangaBackendStatusResult | null>(null);
  const [history, setHistory] = useState<MangaHistoryEntry[]>([]);
  const [showCanvas, setShowCanvas] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("2:3");

  const selectedItems = useMemo(() => {
    const baseItems = items.filter((item) =>
        item.role === "Character"
          ? item.characterId
            ? !!selectedCharacterIds[item.characterId]
            : false
          : !!selected[item.id],
    );
    const baseIds = new Set(baseItems.map((item) => item.id));
    const missingProfileItems = characters
      .filter((character) => selectedCharacterIds[character.id])
      .flatMap((character) => characterImageItems(character, items))
      .filter((item) => !baseIds.has(item.id));
    return [...baseItems, ...missingProfileItems];
  }, [characters, items, selected, selectedCharacterIds]);
  const selectedImageCount = selectedItems.filter((item) => item.imageDataUrl).length;

  const runBackendCheck = useCallback(async () => {
    try {
      const result = await checkMangaBackendViaApi();
      setBackendStatus(result);
    } catch (error) {
      setBackendStatus({
        ok: false,
        backendUrl: "unknown",
        appTokenConfigured: false,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "AI backend check failed.",
      });
    }
  }, []);

  useEffect(() => {
    void runBackendCheck();
  }, [runBackendCheck]);

  useEffect(() => {
    void loadHistory().then(setHistory);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCharacterProfiles().then((savedCharacters) => {
      if (cancelled) return;
      setCharacters(savedCharacters);

      const snap = loadSession<MangaSessionSnapshot>("manga-page");
      if (snap) {
        setItems(mergeCharacterImagesIntoItems(snap.items ?? [], savedCharacters));
        setSelected(snap.selected ?? {});
        setSelectedCharacterIds(snap.selectedCharacterIds ?? {});
        setActiveCharacterId(snap.activeCharacterId ?? savedCharacters[0]?.id ?? "");
        setUploadRole(snap.uploadRole ?? "Character");
        setPrompt(snap.prompt ?? "");
        setEditPrompt(snap.editPrompt ?? "");
        setEditScope(snap.editScope ?? "single");
        setPanelCount(snap.panelCount ?? 6);
        setPanelInstructions(snap.panelInstructions ?? Array.from({ length: 6 }, () => ""));
        setStyleMode(snap.styleMode ?? "auto");
        setBackgroundLevel(snap.backgroundLevel ?? "auto");
        setReadingDirection(snap.readingDirection ?? "right-to-left");
        setAspectRatio(normalizeAspectRatio(snap.aspectRatio));
        setTab(snap.tab ?? "structure");
        setShowCanvas(snap.showCanvas ?? true);
        if (snap.generationResult) setGenerationResult(snap.generationResult);
      } else {
        setActiveCharacterId(savedCharacters[0]?.id ?? "");
        setItems(characterImagesToLibraryItems(savedCharacters));
        setSelected({});
        setSelectedCharacterIds({});
      }
      setCharactersLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (charactersLoaded) {
      setItems((current) => mergeCharacterImagesIntoItems(current, characters));
      void saveCharacterProfiles(characters);
    }
  }, [characters, charactersLoaded]);

  useEffect(() => {
    if (!charactersLoaded) return;
    saveSession<MangaSessionSnapshot>("manga-page", {
      items,
      selected,
      selectedCharacterIds,
      activeCharacterId,
      uploadRole,
      prompt,
      editPrompt,
      editScope,
      panelCount,
      panelInstructions,
      styleMode,
      backgroundLevel,
      readingDirection,
      aspectRatio,
      tab,
      showCanvas,
      generationResult,
    });
  }, [
    charactersLoaded,
    items,
    selected,
    selectedCharacterIds,
    activeCharacterId,
    uploadRole,
    prompt,
    editPrompt,
    editScope,
    panelCount,
    panelInstructions,
    styleMode,
    backgroundLevel,
    readingDirection,
    aspectRatio,
    tab,
    showCanvas,
    generationResult,
  ]);

  const importFiles = async (
    files: FileList | File[],
    forcedRole?: Role,
    forcedCharacterId?: string,
  ) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    setIsImporting(true);
    try {
      const role = forcedRole ?? uploadRole;
      const imported = await Promise.all(
        imageFiles.map(async (file) => {
          const image = await readImageAsDataUrl(file);
          return {
            id: createId("asset"),
            name: fileBaseName(file.name),
            role,
            thumbHue: hueFromName(file.name),
            imageDataUrl: image.dataUrl,
            mimeType: image.mimeType,
            imageWidth: image.width,
            imageHeight: image.height,
            characterId:
              role === "Character" ? (forcedCharacterId ?? activeCharacterId) : undefined,
            description: "",
          } satisfies StoredItem;
        }),
      );
      if (role === "Character") {
        const importedCharacterImages: MangaCharacterImage[] = imported
          .filter((item) => item.imageDataUrl)
          .map((item) => ({
            id: createId("character-image"),
            name: item.name,
            view: "Reference imported from Manga Page Creator",
            imageDataUrl: item.imageDataUrl ?? "",
            mimeType: item.mimeType,
            notes: item.description ?? "",
          }));
        if (importedCharacterImages.length > 0) {
          let targetId = forcedCharacterId ?? activeCharacterId;
          if (!targetId) {
            const created = {
              ...createBlankCharacter(characters.length + 1),
              name: importedCharacterImages[0]?.name || `Character ${characters.length + 1}`,
              images: importedCharacterImages,
            };
            targetId = created.id;
            setCharacters((current) => [created, ...current]);
          } else {
            setCharacters((current) =>
              current.map((character) =>
                character.id === targetId
                  ? {
                      ...character,
                      images: [...(character.images ?? []), ...importedCharacterImages],
                    }
                  : character,
              ),
            );
          }
          setActiveCharacterId(targetId);
          setSelectedCharacterIds((current) => ({ ...current, [targetId]: true }));
          return;
        }
      }
      setItems((current) => [...imported, ...current]);
    } finally {
      setIsImporting(false);
    }
  };

  const addCharacter = () => {
    const character = createBlankCharacter(characters.length + 1);
    setCharacters((current) => [...current, character]);
    setActiveCharacterId(character.id);
    setTab("characters");
  };

  const updateCharacter = (id: string, patch: Partial<CharacterProfile>) => {
    setCharacters((current) =>
      current.map((character) => (character.id === id ? { ...character, ...patch } : character)),
    );
  };

  const updateItem = (id: string, patch: Partial<StoredItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setSelected((current) => {
      const { [id]: _, ...rest } = current;
      return rest;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  };

  const toggleCharacter = (id: string) => {
    setSelectedCharacterIds((current) => ({ ...current, [id]: !current[id] }));
  };

  const updatePanelInstruction = (index: number, value: string) => {
    setPanelInstructions((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const changePanelCount = (count: number) => {
    const nextCount = Math.min(12, Math.max(1, count));
    setPanelCount(nextCount);
    setPanelInstructions((current) =>
      Array.from({ length: nextCount }, (_, index) => current[index] ?? ""),
    );
  };

  const requestImageGeneration = async (operation: GenerationOperation) => {
    setGenerationError(null);
    setIsGenerating(true);
    setShowCanvas(false);

    try {
      const status = await checkMangaBackendViaApi();
      setBackendStatus(status);
      if (!status.ok) {
        throw new Error(status.error || "AI backend is not ready yet.");
      }
      if (!backendSupportsGeneratedImageSize(status, aspectRatio)) {
        const expectedSize = generatedImageDimensions[aspectRatio].size;
        const currentSize = status.manga?.imageSize || "unknown";
        throw new Error(
          `The PulseNote backend deployed on Render is still configured for ${currentSize}, but this request needs ${expectedSize}. Redeploy the PulseNote manga backend before testing this format.`,
        );
      }

      const preparedSelectedItems = await prepareSelectedAssetsForGeneration(
        selectedItems,
        aspectRatio,
        status.manga?.referenceImageAspectGuard === true,
      );
      const result = await generateMangaImageViaApi({
        operation,
        prompt,
        editPrompt,
        editScope,
        activePage: 1,
        pages: [1],
        panelCount,
        panelInstructions,
        selectedAssets: preparedSelectedItems.map((item) => {
          const character = characters.find((profile) => profile.id === item.characterId);
          return {
            ...item,
            characterName: character?.name,
            characterProfile: character
              ? [character.storyRole, character.identityLock, character.defaultExpression]
                  .filter(Boolean)
                  .join(" | ")
              : undefined,
          };
        }),
        characters,
        styleMode,
        backgroundLevel,
        readingDirection,
        aspectRatio,
        existingImageDataUrl: generationResult?.imageUrl,
      });
      const normalizedImageUrl = await normalizeGeneratedImageAspectRatio(
        result.imageUrl,
        aspectRatio,
      );
      const normalizedResult = {
        ...result,
        imageUrl: normalizedImageUrl,
        size: generatedImageDimensions[aspectRatio].size,
      };
      setGenerationResult(normalizedResult);
      void addHistoryEntry({
        imageUrl: normalizedResult.imageUrl,
        prompt,
        finalPrompt: normalizedResult.finalPrompt,
        taskType: normalizedResult.taskType,
        model: normalizedResult.model,
        size: normalizedResult.size,
        quality: normalizedResult.quality,
      }).then((entry) => setHistory((current) => [entry, ...current]));
      setShowCanvas(false);
      setTab("references");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadGeneratedImage = () => {
    if (!generationResult?.imageUrl) return;
    const link = document.createElement("a");
    link.href = generationResult.imageUrl;
    link.download = `collabmanga-page-${Date.now()}.png`;
    link.click();
  };

  const selectHistoryEntry = (entry: MangaHistoryEntry) => {
    setGenerationError(null);
    setGenerationResult({
      imageUrl: entry.imageUrl,
      finalPrompt: entry.finalPrompt,
      taskType: entry.taskType as MangaImageGenerationResult["taskType"],
      model: entry.model,
      size: entry.size,
      quality: entry.quality,
      createdAt: entry.createdAt,
    });
    setShowCanvas(false);
  };

  const deleteHistoryEntry = (id: string) => {
    void removeHistoryEntry(id);
    setHistory((current) => current.filter((entry) => entry.id !== id));
  };

  const addCanvasAsItem = (dataUrl: string, role: Role) => {
    const item: StoredItem = {
      id: createId("asset"),
      name: role === "Storyboard" ? "Canvas structure" : "Canvas reference",
      role,
      thumbHue: hueFromName("canvas"),
      imageDataUrl: dataUrl,
      mimeType: "image/png",
      description: "",
    };
    setItems((current) => [item, ...current]);
    setSelected((current) => ({ ...current, [item.id]: true }));
    setTab(role === "Storyboard" ? "structure" : "references");
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-9">Manga Page Creator</h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Characters, references, panel plan, and AI generation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => requestImageGeneration("generate")}
            disabled={isGenerating || !prompt.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate page"}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:gap-5 xl:[grid-template-columns:minmax(0,3fr)_minmax(0,2fr)]">
        {showCanvas ? (
          <PanelCard className="xl:max-h-[calc(100vh-105px)]">
            <PlancheCanvas
              title="Planche canvas"
              onUseAsStructure={(dataUrl) => addCanvasAsItem(dataUrl, "Storyboard")}
              onUseAsReference={(dataUrl) => addCanvasAsItem(dataUrl, "Inspiration")}
              hasResult={Boolean(generationResult)}
              onShowResult={() => setShowCanvas(false)}
            />
          </PanelCard>
        ) : (
          <GenerationPanel
            result={generationResult}
            error={generationError}
            isGenerating={isGenerating}
            selectedItems={selectedItems}
            selectedImageCount={selectedImageCount}
            prompt={prompt}
            aspectRatio={aspectRatio}
            history={history}
            onSelectHistory={selectHistoryEntry}
            onDeleteHistory={deleteHistoryEntry}
            onReturnToCanvas={() => setShowCanvas(true)}
            onGenerate={() => requestImageGeneration("generate")}
            onRegenerate={() => requestImageGeneration("regenerate")}
            onDownload={downloadGeneratedImage}
          />
        )}

        <WorkspacePanel
          tab={tab}
          setTab={setTab}
          prompt={prompt}
          setPrompt={setPrompt}
          editPrompt={editPrompt}
          setEditPrompt={setEditPrompt}
          editScope={editScope}
          setEditScope={setEditScope}
          panelCount={panelCount}
          changePanelCount={changePanelCount}
          panelInstructions={panelInstructions}
          updatePanelInstruction={updatePanelInstruction}
          characters={characters}
          updateCharacter={updateCharacter}
          addCharacter={addCharacter}
          items={items}
          selected={selected}
          toggleSelect={toggleSelect}
          updateItem={updateItem}
          removeItem={removeItem}
          importFiles={importFiles}
          isImporting={isImporting}
          selectedCharacterIds={selectedCharacterIds}
          toggleCharacter={toggleCharacter}
          selectedItems={selectedItems}
          styleMode={styleMode}
          setStyleMode={setStyleMode}
          backgroundLevel={backgroundLevel}
          setBackgroundLevel={setBackgroundLevel}
          readingDirection={readingDirection}
          setReadingDirection={setReadingDirection}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          hasResult={Boolean(generationResult)}
          generationError={generationError}
          isGenerating={isGenerating}
          onGenerate={() => requestImageGeneration("generate")}
          onApplyEdit={() => requestImageGeneration("edit")}
        />
      </div>
    </div>
  );
}

function PanelCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border p-4">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-accent" />
        <h2 className="truncate font-display text-base font-bold">{title}</h2>
      </div>
      {typeof count === "number" && (
        <span className="rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
          {count}
        </span>
      )}
    </header>
  );
}

function SelectedElementsList({
  items,
  selected,
  selectedCharacterIds,
  characters,
}: {
  items: StoredItem[];
  selected: Record<string, boolean>;
  selectedCharacterIds: Record<string, boolean>;
  characters: CharacterProfile[];
}) {
  const entries: Array<{ key: string; title: string; item?: StoredItem }> = [
    ...items
      .filter((item) => item.role === "Storyboard" && selected[item.id])
      .map((item) => ({ key: item.id, title: "Structure de la planche", item })),
    ...characters
      .filter((character) => selectedCharacterIds[character.id])
      .map((character) => ({
        key: `character-${character.id}`,
        title: character.name || "Personnage",
        item: firstCharacterImageItem(character, items),
      })),
    ...items
      .filter((item) => referenceRoles.includes(item.role) && selected[item.id])
      .map((item) => ({ key: item.id, title: "Référence", item })),
  ];

  if (entries.length === 0) {
    return <EmptyState icon={ImageIcon} title="Aucun élément sélectionné" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="flex items-center gap-3 rounded-[14px] border border-border bg-surface-3 p-3"
        >
          {entry.item ? (
            <AssetThumb item={entry.item} sizeClass="h-[64px] w-[52px]" />
          ) : (
            <div className="flex h-[64px] w-[52px] shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-muted">
              <User className="h-5 w-5" />
            </div>
          )}
          <p className="min-w-0 flex-1 text-[13px] font-bold text-text-primary">{entry.title}</p>
        </div>
      ))}
    </div>
  );
}

function getPromptSelectedEntries(
  items: StoredItem[],
  selected: Record<string, boolean>,
  selectedCharacterIds: Record<string, boolean>,
  characters: CharacterProfile[],
) {
  return [
    ...items
      .filter((item) => item.role === "Storyboard" && selected[item.id])
      .map((item) => ({ key: item.id, title: "Structure", item })),
    ...characters
      .filter((character) => selectedCharacterIds[character.id])
      .map((character) => ({
        key: `character-${character.id}`,
        title: character.name || "Personnage",
        item: firstCharacterImageItem(character, items),
      })),
    ...items
      .filter((item) => referenceRoles.includes(item.role) && selected[item.id])
      .map((item) => ({ key: item.id, title: "Reference", item })),
  ];
}

function SelectedElementsInline({
  items,
  selected,
  selectedCharacterIds,
  characters,
}: {
  items: StoredItem[];
  selected: Record<string, boolean>;
  selectedCharacterIds: Record<string, boolean>;
  characters: CharacterProfile[];
}) {
  const entries = getPromptSelectedEntries(items, selected, selectedCharacterIds, characters);
  const visibleEntries = entries.slice(0, 6);
  const remainingCount = entries.length - visibleEntries.length;

  return (
    <div className="rounded-[14px] border border-border bg-surface-3 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-accent" />
          <p className="truncate text-[12px] font-bold text-text-primary">Elements selectionnes</p>
        </div>
        <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[12px] text-text-muted">Aucun element selectionne.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {visibleEntries.map((entry) => (
            <div key={entry.key} className="min-w-0">
              {entry.item ? (
                <AssetThumb item={entry.item} sizeClass="aspect-square h-auto w-full" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-muted">
                  <User className="h-4 w-4" />
                </div>
              )}
              <p className="mt-1 truncate text-[10px] font-semibold text-text-secondary">
                {entry.title}
              </p>
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="flex aspect-square items-center justify-center rounded-[10px] border border-border bg-surface-2 text-[12px] font-bold text-text-secondary">
              +{remainingCount}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  maxWidth = 480,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,7,18,0.82)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[18px] border border-border bg-surface-2"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scroll-dark min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function ImageImporter({
  uploadRole,
  setUploadRole,
  characters,
  activeCharacterId,
  setActiveCharacterId,
  isImporting,
  importFiles,
}: {
  uploadRole: Role;
  setUploadRole: (role: Role) => void;
  characters: CharacterProfile[];
  activeCharacterId: string;
  setActiveCharacterId: (id: string) => void;
  isImporting: boolean;
  importFiles: (files: FileList | File[], forcedRole?: Role) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="rounded-[14px] border border-dashed border-border-strong bg-surface-3/40 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void importFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.currentTarget.files) void importFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isImporting}
          className="flex min-h-[76px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-border bg-surface-2 px-3 text-text-primary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-5 w-5" />
          <span className="text-[13px] font-bold">
            {isImporting ? "Importing..." : "Import images"}
          </span>
        </button>
        <select
          value={uploadRole}
          onChange={(event) => setUploadRole(event.target.value as Role)}
          className="h-9 rounded-[10px] border border-border bg-input px-2 text-[12px] font-semibold text-text-primary outline-none focus:border-accent"
        >
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        {uploadRole === "Character" && (
          <select
            value={activeCharacterId}
            onChange={(event) => setActiveCharacterId(event.target.value)}
            disabled={characters.length === 0}
            className="h-9 rounded-[10px] border border-border bg-input px-2 text-[12px] font-semibold text-text-primary outline-none focus:border-accent"
          >
            <option value="">
              {characters.length === 0 ? "Create a profile first" : "No profile"}
            </option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function LibraryItemCard({
  item,
  characters,
  selected,
  toggleSelect,
  updateItem,
  removeItem,
}: {
  item: StoredItem;
  characters: CharacterProfile[];
  selected: boolean;
  toggleSelect: () => void;
  updateItem: (patch: Partial<StoredItem>) => void;
  removeItem: () => void;
}) {
  return (
    <div
      className={`rounded-[14px] border p-3 transition ${
        selected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3"
      }`}
    >
      <div className="flex gap-3">
        <AssetThumb item={item} sizeClass="h-[86px] w-[68px]" />
        <div className="min-w-0 flex-1">
          <input
            value={item.name}
            onChange={(event) => updateItem({ name: event.target.value })}
            className="h-8 w-full rounded-[8px] border border-transparent bg-transparent px-1 text-[13px] font-bold text-text-primary outline-none focus:border-border focus:bg-input"
          />
          <div className="mt-2 grid grid-cols-1 gap-2">
            <select
              value={item.role}
              onChange={(event) => updateItem({ role: event.target.value as Role })}
              className="h-8 rounded-[9px] border border-border bg-input px-2 text-[11px] font-semibold text-text-primary outline-none focus:border-accent"
            >
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            {item.role === "Character" && (
              <select
                value={item.characterId ?? ""}
                onChange={(event) => updateItem({ characterId: event.target.value })}
                className="h-8 rounded-[9px] border border-border bg-input px-2 text-[11px] font-semibold text-text-primary outline-none focus:border-accent"
              >
                <option value="">No profile</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end justify-between">
          <button
            onClick={removeItem}
            aria-label={`Remove ${item.name}`}
            className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={toggleSelect}
            aria-pressed={selected}
            className={`flex h-7 w-7 items-center justify-center rounded-md border ${
              selected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border-strong text-transparent hover:border-accent"
            }`}
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
      <textarea
        value={item.description ?? ""}
        onChange={(event) => updateItem({ description: event.target.value })}
        rows={2}
        placeholder="Role details for the prompt"
        className="mt-3 w-full resize-none rounded-[10px] border border-border bg-input px-3 py-2 text-[12px] leading-5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
      />
    </div>
  );
}

function AssetThumb({ item, sizeClass }: { item: StoredItem; sizeClass: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[10px] border border-border bg-surface-2 ${sizeClass}`}
      style={
        item.imageDataUrl
          ? undefined
          : {
              background: `radial-gradient(120% 100% at 20% 10%, hsl(${item.thumbHue} 70% 55% / 0.55), transparent 60%), linear-gradient(135deg, #0e1736, #101b3f)`,
            }
      }
    >
      {item.imageDataUrl ? (
        <img src={item.imageDataUrl} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-text-muted" />
      )}
    </div>
  );
}

function GenerationPanel({
  result,
  error,
  isGenerating,
  selectedImageCount,
  prompt,
  aspectRatio,
  history,
  onSelectHistory,
  onDeleteHistory,
  onReturnToCanvas,
  onGenerate,
  onRegenerate,
  onDownload,
}: {
  result: MangaImageGenerationResult | null;
  error: string | null;
  isGenerating: boolean;
  selectedItems: StoredItem[];
  selectedImageCount: number;
  prompt: string;
  aspectRatio: AspectRatio;
  history: MangaHistoryEntry[];
  onSelectHistory: (entry: MangaHistoryEntry) => void;
  onDeleteHistory: (id: string) => void;
  onReturnToCanvas: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  const [lightbox, setLightbox] = useState<{
    imageUrl: string;
    prompt?: string;
    entry?: MangaHistoryEntry;
  } | null>(null);
  const portrait = aspectRatio !== "3:2";

  const downloadUrl = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `collabmanga-page-${Date.now()}.png`;
    link.click();
  };

  return (
    <>
      <PanelCard className="xl:max-h-[calc(100vh-105px)]">
        <SectionHeader icon={FileImage} title="Generated page" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-border bg-surface-3 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-[12px] font-bold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {selectedImageCount} image refs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onReturnToCanvas}
              className="flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-2.5 text-[12px] font-bold text-text-secondary hover:text-text-primary"
            >
              <PenTool className="h-3.5 w-3.5" />
              Canvas
            </button>
            <button
              onClick={onDownload}
              disabled={!result}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onRegenerate}
              disabled={isGenerating || !prompt.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Regenerate"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="my-4 flex flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-stage p-4">
          <div className="relative flex h-full max-h-[680px] w-full max-w-[560px] items-center justify-center">
            <div
              className="relative overflow-hidden rounded-[10px] bg-artboard shadow-[0_30px_60px_-20px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)]"
              style={{
                aspectRatio: portrait ? "2 / 3" : "3 / 2",
                maxHeight: "100%",
                maxWidth: "100%",
                height: portrait ? "100%" : "auto",
                width: portrait ? "auto" : "100%",
              }}
            >
              {isGenerating ? (
                <GeneratingIndicator />
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center bg-[#f7faff] px-8 text-center text-[#0b1430]">
                  <X className="mb-4 h-10 w-10 text-danger" />
                  <p className="text-[16px] font-bold">Generation failed</p>
                  <p className="mt-2 max-w-[340px] text-[12px] leading-5 text-[#5e6a90]">{error}</p>
                </div>
              ) : result ? (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({ imageUrl: result.imageUrl, prompt: result.finalPrompt })
                  }
                  className="block h-full w-full cursor-zoom-in"
                  title="Voir en grand"
                >
                  <img
                    src={result.imageUrl}
                    alt="Generated manga page"
                    className="h-full w-full object-contain"
                  />
                </button>
              ) : (
                <MangaPagePlaceholder />
              )}
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="rounded-[14px] border border-border bg-surface-3 p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-primary">
              <History className="h-4 w-4 text-accent" />
              History
              <span className="text-text-muted">({history.length})</span>
            </div>
            <div className="scroll-dark flex gap-2 overflow-x-auto pb-1">
              {history.map((entry) => (
                <div key={entry.id} className="group relative shrink-0">
                  <button
                    onClick={() =>
                      setLightbox({ imageUrl: entry.imageUrl, prompt: entry.prompt, entry })
                    }
                    title={entry.prompt}
                    className={`block h-[72px] w-[52px] overflow-hidden rounded-[10px] border ${
                      result?.imageUrl === entry.imageUrl
                        ? "border-accent"
                        : "border-border hover:border-accent"
                    }`}
                  >
                    <img
                      src={entry.imageUrl}
                      alt={entry.prompt}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    onClick={() => onDeleteHistory(entry.id)}
                    aria-label="Delete from history"
                    className="absolute right-0.5 top-0.5 rounded-md bg-black/60 p-0.5 text-white/80 opacity-0 transition hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Wand2 className="h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate with current setup"}
        </button>
      </div>
      </PanelCard>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,7,18,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-[900px] flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightbox.imageUrl}
              alt={lightbox.prompt ?? "Generated manga page"}
              className="min-h-0 w-full rounded-[14px] object-contain"
              style={{ maxHeight: "82vh" }}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              {lightbox.entry && (
                <button
                  onClick={() => {
                    if (lightbox.entry) onSelectHistory(lightbox.entry);
                    setLightbox(null);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-border bg-surface-2 px-3 text-[13px] font-bold text-text-primary hover:border-accent hover:text-accent"
                >
                  <RefreshCw className="h-4 w-4" />
                  Utiliser cette image
                </button>
              )}
              <button
                onClick={() => downloadUrl(lightbox.imageUrl)}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GeneratingIndicator() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#f7faff] px-8 text-center text-[#0b1430]">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-[#d7e0f4]" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#12b76a]" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 animate-pulse text-[#12b76a]" />
      </div>
      <div>
        <p className="text-[15px] font-bold">Génération en cours</p>
        <p className="mt-1 text-[12px] text-[#5e6a90]">L'IA compose votre planche…</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-2 w-2 animate-bounce rounded-full bg-[#12b76a]"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function MangaPagePlaceholder() {
  return (
    <svg viewBox="0 0 210 297" className="h-full w-full bg-white">
      <rect x="0" y="0" width="210" height="297" fill="#f7faff" />
      <g fill="none" stroke="#0b1430" strokeWidth="2">
        <rect x="12" y="12" width="86" height="58" />
        <rect x="108" y="12" width="90" height="58" />
        <rect x="12" y="82" width="186" height="62" />
        <rect x="12" y="156" width="58" height="56" />
        <rect x="80" y="156" width="118" height="56" />
        <rect x="12" y="224" width="186" height="60" />
      </g>
      <g fill="#0b1430" opacity="0.85">
        <circle cx="56" cy="42" r="11" />
        <path d="M45 61 Q56 46 70 61" />
        <circle cx="155" cy="42" r="11" />
        <path d="M144 61 Q155 47 171 61" />
        <path d="M60 114 C88 92 122 92 151 114" stroke="#0b1430" strokeWidth="4" fill="none" />
        <path d="M93 184 L136 170" stroke="#0b1430" strokeWidth="5" fill="none" />
        <path d="M74 252 L146 252" stroke="#0b1430" strokeWidth="5" fill="none" />
      </g>
    </svg>
  );
}

function WorkspacePanel(props: {
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  editPrompt: string;
  setEditPrompt: (prompt: string) => void;
  editScope: "single" | "full";
  setEditScope: (scope: "single" | "full") => void;
  panelCount: number;
  changePanelCount: (count: number) => void;
  panelInstructions: string[];
  updatePanelInstruction: (index: number, value: string) => void;
  characters: CharacterProfile[];
  updateCharacter: (id: string, patch: Partial<CharacterProfile>) => void;
  addCharacter: () => void;
  items: StoredItem[];
  selected: Record<string, boolean>;
  toggleSelect: (id: string) => void;
  updateItem: (id: string, patch: Partial<StoredItem>) => void;
  removeItem: (id: string) => void;
  importFiles: (files: FileList | File[], forcedRole?: Role, forcedCharacterId?: string) => void;
  isImporting: boolean;
  selectedCharacterIds: Record<string, boolean>;
  toggleCharacter: (id: string) => void;
  selectedItems: StoredItem[];
  styleMode: "auto" | "black-white" | "color";
  setStyleMode: (style: "auto" | "black-white" | "color") => void;
  backgroundLevel: "auto" | "empty" | "minimal" | "detailed";
  setBackgroundLevel: (level: "auto" | "empty" | "minimal" | "detailed") => void;
  readingDirection: "right-to-left" | "left-to-right";
  setReadingDirection: (direction: "right-to-left" | "left-to-right") => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (value: AspectRatio) => void;
  hasResult: boolean;
  generationError: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onApplyEdit: () => void;
}) {
  return (
    <PanelCard className="xl:max-h-[calc(100vh-105px)]">
      <div className="flex items-center gap-1 border-b border-border p-3">
        {(
          [
            { id: "structure", label: "Structure" },
            { id: "characters", label: "Personnages" },
            { id: "references", label: "Références" },
            { id: "prompt", label: "Prompt" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => props.setTab(tab.id)}
            className={`min-h-[38px] min-w-0 flex-1 rounded-[12px] px-2 py-1 text-center text-[12px] font-bold leading-tight transition ${
              props.tab === tab.id
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="scroll-dark flex-1 overflow-y-auto p-4">
        {props.tab === "structure" && <StructureTab {...props} />}
        {props.tab === "characters" && <CharactersTab {...props} />}
        {props.tab === "references" && <ReferencesTab {...props} />}
        {props.tab === "prompt" && <PromptTab {...props} />}
      </div>

      <div className="space-y-2 border-t border-border p-4">
        {props.tab === "prompt" && (
          <SelectedElementsInline
            items={props.items}
            selected={props.selected}
            selectedCharacterIds={props.selectedCharacterIds}
            characters={props.characters}
          />
        )}
        <button
          onClick={props.onGenerate}
          disabled={props.isGenerating || !props.prompt.trim()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {props.isGenerating ? "Generating..." : "Generate Final Page"}
        </button>
        {props.generationError && (
          <div className="rounded-[12px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] font-semibold leading-relaxed text-danger">
            {props.generationError}
          </div>
        )}
        {props.hasResult && (
          <button
            onClick={props.onApplyEdit}
            disabled={props.isGenerating || !props.editPrompt.trim()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-border-strong px-4 text-[13px] font-bold text-text-primary hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PencilRuler className="h-4 w-4" />
            Apply edit to result
          </button>
        )}
      </div>
    </PanelCard>
  );
}

function PromptTab({
  prompt,
  setPrompt,
  editPrompt,
  setEditPrompt,
  editScope,
  setEditScope,
  styleMode,
  setStyleMode,
  backgroundLevel,
  setBackgroundLevel,
  readingDirection,
  setReadingDirection,
  aspectRatio,
  setAspectRatio,
  hasResult,
}: Parameters<typeof WorkspacePanel>[0]) {
  return (
    <div className="flex flex-col gap-4">
      <FieldLabel label="Describe the page" />
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={8}
        placeholder="Scene, action, panel hierarchy, emotions, dialogue, style..."
        className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3.5 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label="Style"
          value={styleMode}
          onChange={(value) => setStyleMode(value as "auto" | "black-white" | "color")}
          options={[
            ["black-white", "Black and white"],
            ["color", "Color"],
            ["auto", "Prompt decides"],
          ]}
        />
        <SelectField
          label="Background"
          value={backgroundLevel}
          onChange={(value) =>
            setBackgroundLevel(value as "auto" | "empty" | "minimal" | "detailed")
          }
          options={[
            ["minimal", "Minimal"],
            ["detailed", "Detailed"],
            ["empty", "Empty"],
            ["auto", "Prompt decides"],
          ]}
        />
        <SelectField
          label="Reading"
          value={readingDirection}
          onChange={(value) => setReadingDirection(value as "right-to-left" | "left-to-right")}
          options={[
            ["right-to-left", "Right to left"],
            ["left-to-right", "Left to right"],
          ]}
        />
        <SelectField
          label="Format"
          value={aspectRatio}
          onChange={(value) => setAspectRatio(value as AspectRatio)}
          options={[
            ["2:3", "Portrait 2:3"],
            ["3:2", "Paysage 3:2"],
          ]}
        />
      </div>

      {hasResult && (
        <div className="rounded-[14px] border border-border bg-surface-3 p-3">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-[12px] border border-border bg-surface-2 p-1">
            {(["single", "full"] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setEditScope(scope)}
                className={`h-9 rounded-[10px] px-2 text-[12px] font-bold ${
                  editScope === scope
                    ? "bg-accent text-accent-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {scope === "single" ? "Single panel" : "Full page"}
              </button>
            ))}
          </div>
          <FieldLabel label="Modification prompt" />
          <textarea
            value={editPrompt}
            onChange={(event) => setEditPrompt(event.target.value)}
            rows={4}
            placeholder="Precise correction to apply..."
            className="w-full resize-none rounded-[12px] border border-border bg-input px-3 py-2.5 text-[13px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  );
}

function CharactersTab({
  characters,
  items,
  selectedCharacterIds,
  toggleCharacter,
}: Parameters<typeof WorkspacePanel>[0]) {
  if (characters.length === 0) {
    return <EmptyState icon={User} title="No character profile yet" />;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {characters.map((character) => {
        const firstImage = firstCharacterImageItem(character, items);
        const isSelected = !!selectedCharacterIds[character.id];

        return (
          <button
            key={character.id}
            onClick={() => toggleCharacter(character.id)}
            aria-pressed={isSelected}
            className={`group min-w-0 rounded-[14px] border p-2 text-left transition ${
              isSelected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3"
            }`}
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] border border-border bg-surface-2">
              {firstImage?.imageDataUrl ? (
                <img
                  src={firstImage.imageDataUrl}
                  alt={character.name || "Character"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <span
                className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border ${
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border-strong bg-surface-2/85 text-transparent group-hover:border-accent"
                }`}
              >
                <Check className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 truncate text-center text-[12px] font-bold text-text-primary">
              {character.name || "Personnage"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CharactersTabOld({
  characters,
  updateCharacter,
  items,
  importFiles,
  isImporting,
  selectedCharacterIds,
  toggleCharacter,
}: Parameters<typeof WorkspacePanel>[0]) {
  return (
    <div className="flex flex-col gap-3">
      {characters.map((character) => {
        const firstImage = firstCharacterImageItem(character, items);
        const isSelected = !!selectedCharacterIds[character.id];
        return (
          <div
            key={character.id}
            className={`rounded-[14px] border p-3 transition ${
              isSelected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-accent-border bg-accent-soft text-accent">
                <User className="h-4 w-4" />
              </span>
              <input
                value={character.name}
                onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
                className="h-9 min-w-0 flex-1 rounded-[10px] border border-border bg-input px-3 text-[13px] font-bold text-text-primary outline-none focus:border-accent"
              />
              <button
                onClick={() => toggleCharacter(character.id)}
                aria-pressed={isSelected}
                aria-label={`Select ${character.name}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border-strong text-transparent hover:border-accent"
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => toggleCharacter(character.id)}
              className="mt-3 flex w-full items-center gap-3 rounded-[12px] border border-border bg-surface-2 p-2 text-left hover:border-accent"
            >
              {firstImage ? (
                <AssetThumb item={firstImage} sizeClass="h-[72px] w-[58px]" />
              ) : (
                <div className="flex h-[72px] w-[58px] shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface-3 text-text-muted">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <span className="min-w-0 flex-1 text-[12px] text-text-secondary">
                {isSelected
                  ? "Selected — all this character's images will be used."
                  : "Select this character for the page."}
              </span>
            </button>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <TextField
                label="Narrative role"
                value={character.storyRole}
                onChange={(value) => updateCharacter(character.id, { storyRole: value })}
              />
              <TextAreaField
                label="Identity lock"
                value={character.identityLock}
                onChange={(value) => updateCharacter(character.id, { identityLock: value })}
                rows={3}
              />
              <TextAreaField
                label="Default expression"
                value={character.defaultExpression}
                onChange={(value) => updateCharacter(character.id, { defaultExpression: value })}
                rows={2}
              />
            </div>

            <div className="mt-3">
              <TabImportButton
                label="Import character image"
                role="Character"
                characterId={character.id}
                importFiles={importFiles}
                isImporting={isImporting}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const referenceRoles: Role[] = ["Background", "Object", "Pose", "Style", "Inspiration", "Target"];

function StructureTab({
  items,
  selected,
  toggleSelect,
  removeItem,
  importFiles,
  isImporting,
}: Parameters<typeof WorkspacePanel>[0]) {
  const structureItems = items.filter((item) => item.role === "Storyboard");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-5 text-text-secondary">
        Import an image that defines the panel layout and structure of the page.
      </p>
      <TabImportButton
        label="Import page structure"
        role="Storyboard"
        importFiles={importFiles}
        isImporting={isImporting}
      />
      {structureItems.length === 0 ? (
        <EmptyState icon={FileImage} title="No structure image imported" />
      ) : (
        structureItems.map((item) => (
          <WorkspaceAssetTile
            key={item.id}
            item={item}
            selected={!!selected[item.id]}
            onToggle={() => toggleSelect(item.id)}
            onRemove={() => removeItem(item.id)}
          />
        ))
      )}
    </div>
  );
}

function ReferencesTab({
  items,
  selected,
  toggleSelect,
  updateItem,
  removeItem,
  importFiles,
  isImporting,
}: Parameters<typeof WorkspacePanel>[0]) {
  const refItems = items.filter((item) => referenceRoles.includes(item.role));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-5 text-text-secondary">
        Import reference images and add details describing what each reference is used for.
      </p>
      <TabImportButton
        label="Import a reference"
        role="Inspiration"
        importFiles={importFiles}
        isImporting={isImporting}
      />
      {refItems.length === 0 ? (
        <EmptyState icon={BookImage} title="No reference imported" />
      ) : (
        refItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-[14px] border p-3 ${
              selected[item.id]
                ? "border-accent-border bg-accent-soft/30"
                : "border-border bg-surface-3"
            }`}
          >
            <div className="flex gap-3">
              <AssetThumb item={item} sizeClass="h-[86px] w-[68px]" />
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <p className="truncate text-[13px] font-bold text-text-primary">{item.name}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSelect(item.id)}
                    aria-pressed={!!selected[item.id]}
                    aria-label={`Select ${item.name}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                      selected[item.id]
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border-strong text-transparent hover:border-accent"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <textarea
              value={item.description ?? ""}
              onChange={(event) => updateItem(item.id, { description: event.target.value })}
              rows={2}
              placeholder="What is this reference for?"
              className="mt-3 w-full resize-none rounded-[10px] border border-border bg-input px-3 py-2 text-[12px] leading-5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
          </div>
        ))
      )}
    </div>
  );
}

function TabImportButton({
  label,
  role,
  characterId,
  importFiles,
  isImporting,
}: {
  label: string;
  role: Role;
  characterId?: string;
  importFiles: (files: FileList | File[], forcedRole?: Role, forcedCharacterId?: string) => void;
  isImporting: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.currentTarget.files)
            void importFiles(event.currentTarget.files, role, characterId);
          event.currentTarget.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isImporting}
        className="flex min-h-[64px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong bg-surface-2 px-3 text-text-primary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload className="h-5 w-5" />
        <span className="text-[13px] font-bold">{isImporting ? "Importing..." : label}</span>
      </button>
    </div>
  );
}

function WorkspaceAssetTile({
  item,
  selected,
  onToggle,
  onRemove,
}: {
  item: StoredItem;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[12px] border p-2 ${
        selected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3"
      }`}
    >
      <AssetThumb item={item} sizeClass="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-text-primary">{item.name}</p>
        <p className="truncate text-[11px] text-text-muted">{item.role}</p>
      </div>
      <button
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`Select ${item.name}`}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${
          selected
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border-strong text-transparent hover:border-accent"
        }`}
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ReferencesSummary({ selectedItems }: { selectedItems: StoredItem[] }) {
  const groups = roleOptions
    .map((role) => ({
      role: role.value,
      label: role.label,
      items: selectedItems.filter((item) => item.role === role.value),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.length === 0 ? (
        <EmptyState icon={BookImage} title="No selected references" />
      ) : (
        groups.map((group) => (
          <div key={group.role} className="rounded-[14px] border border-border bg-surface-3 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <RoleChip role={group.role} />
              <span className="text-[11px] font-semibold text-text-muted">
                {group.items.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {group.items.map((item) => (
                <div key={item.id} className="min-w-0">
                  <AssetThumb item={item} sizeClass="aspect-square h-auto w-full" />
                  <p className="mt-1 truncate text-[11px] font-semibold text-text-secondary">
                    {item.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      <div className="rounded-[14px] border border-border bg-surface-3 p-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          <p className="text-[12px] font-bold text-text-primary">Prompt lock summary</p>
        </div>
        <p className="mt-2 text-[12px] leading-5 text-text-secondary">
          Character images define identity, storyboard images define structure, pose images define
          body mechanics, style images define rendering, and inspiration images cannot override
          identities or panel functions.
        </p>
      </div>
    </div>
  );
}

function PanelsTab({
  panelCount,
  changePanelCount,
  panelInstructions,
  updatePanelInstruction,
}: Parameters<typeof WorkspacePanel>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[14px] border border-border bg-surface-3 p-3">
        <FieldLabel label="Panel count" />
        <input
          type="number"
          min={1}
          max={12}
          value={panelCount}
          onChange={(event) => changePanelCount(Number(event.target.value))}
          className="h-10 w-full rounded-[10px] border border-border bg-input px-3 text-[13px] font-bold text-text-primary outline-none focus:border-accent"
        />
      </div>
      {panelInstructions.map((instruction, index) => (
        <div key={index} className="rounded-[14px] border border-border bg-surface-3 p-3">
          <FieldLabel label={`Panel ${index + 1}`} />
          <textarea
            value={instruction}
            onChange={(event) => updatePanelInstruction(index, event.target.value)}
            rows={3}
            className="w-full resize-none rounded-[10px] border border-border bg-input px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none focus:border-accent"
          />
        </div>
      ))}
    </div>
  );
}

function RoleChip({ role }: { role: Role }) {
  const roleIcon: Record<Role, React.ReactNode> = {
    Character: <User className="h-3 w-3" />,
    Background: <Mountain className="h-3 w-3" />,
    Object: <Package className="h-3 w-3" />,
    Storyboard: <FileImage className="h-3 w-3" />,
    Pose: <PencilRuler className="h-3 w-3" />,
    Style: <Layers className="h-3 w-3" />,
    Inspiration: <BookImage className="h-3 w-3" />,
    Target: <ImageIcon className="h-3 w-3" />,
    "Generated Page": <Sparkles className="h-3 w-3" />,
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
      {roleIcon[role]}
      {role}
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-surface-3 p-3">
      <FieldLabel label={label} />
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-[10px] border border-border bg-input px-3 pr-8 text-[13px] font-bold text-text-primary outline-none focus:border-accent"
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel label={label} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-[10px] border border-border bg-input px-3 text-[13px] text-text-primary outline-none focus:border-accent"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div>
      <FieldLabel label={label} />
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full resize-none rounded-[10px] border border-border bg-input px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none focus:border-accent"
      />
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-text-muted">
      {label}
    </label>
  );
}

function EmptyState({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-surface-3/50 p-5 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-text-muted" />
      <p className="text-[13px] font-semibold text-text-secondary">{title}</p>
    </div>
  );
}
