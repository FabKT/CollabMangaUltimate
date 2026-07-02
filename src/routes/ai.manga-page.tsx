import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkMangaImageBackend,
  generateMangaImage,
  type MangaBackendStatusResult,
  type MangaImageGenerationInput,
  type MangaImageGenerationResult,
} from "@/server-functions/manga-image";
import {
  BookImage,
  Check,
  ChevronDown,
  Download,
  FileImage,
  ImageIcon,
  Layers,
  Lightbulb,
  Mountain,
  Package,
  PencilRuler,
  Plus,
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

type CharacterProfile = {
  id: string;
  name: string;
  storyRole: string;
  identityLock: string;
  defaultExpression: string;
};

type StoredItem = {
  id: string;
  name: string;
  role: Role;
  thumbHue: number;
  imageDataUrl?: string;
  mimeType?: string;
  characterId?: string;
  description?: string;
};

type WorkspaceTab = "prompt" | "characters" | "references" | "panels";
type GenerationOperation = MangaImageGenerationInput["operation"];

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

const initialCharacters: CharacterProfile[] = [
  {
    id: "akira",
    name: "Akira",
    storyRole: "Protagonist",
    identityLock: "Sharp eyes, black messy hair, slim athletic silhouette, dark jacket.",
    defaultExpression: "Focused and determined.",
  },
  {
    id: "yuki",
    name: "Yuki",
    storyRole: "Rival",
    identityLock: "Long pale hair, calm face, elegant coat, colder silhouette.",
    defaultExpression: "Calm, unreadable, slightly threatening.",
  },
];

const initialPanelInstructions = [
  "Establish the place and mood with both characters positioned in the scene.",
  "Close-up on Akira noticing the threat.",
  "Main action beat with strong motion and clear body orientation.",
  "Reaction from Yuki, expression controlled but intense.",
  "Object/detail shot that reinforces the tension.",
  "Dominant final panel with impact, readable silhouettes, and clean gutters.",
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

async function readImageAsDataUrl(file: File) {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });

  return new Promise<{ dataUrl: string; mimeType: string }>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      if (scale >= 1 && file.size < 1_800_000) {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.88), mimeType: "image/jpeg" });
    };
    image.onerror = () => resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
    image.src = rawDataUrl;
  });
}

export default function CollabMangaAIPage() {
  const generateMangaImageFn = useServerFn(generateMangaImage);
  const checkMangaImageBackendFn = useServerFn(checkMangaImageBackend);
  const [tab, setTab] = useState<WorkspaceTab>("prompt");
  const [items, setItems] = useState<StoredItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [characters, setCharacters] = useState<CharacterProfile[]>(initialCharacters);
  const [activeCharacterId, setActiveCharacterId] = useState(initialCharacters[0]?.id ?? "");
  const [uploadRole, setUploadRole] = useState<Role>("Character");
  const [prompt, setPrompt] = useState(
    "Create a vertical manga page where Akira confronts Yuki on a rooftop at dusk. Keep the panel layout readable, with dramatic manga ink, clear silhouettes, and strong emotional beats.",
  );
  const [editPrompt, setEditPrompt] = useState("");
  const [editScope, setEditScope] = useState<"single" | "full">("single");
  const [panelCount, setPanelCount] = useState(6);
  const [panelInstructions, setPanelInstructions] = useState(initialPanelInstructions);
  const [styleMode, setStyleMode] = useState<"auto" | "black-white" | "color">("black-white");
  const [backgroundLevel, setBackgroundLevel] = useState<"auto" | "empty" | "minimal" | "detailed">(
    "minimal",
  );
  const [readingDirection, setReadingDirection] = useState<"right-to-left" | "left-to-right">(
    "right-to-left",
  );
  const [generationResult, setGenerationResult] = useState<MangaImageGenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<MangaBackendStatusResult | null>(null);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  const selectedItems = useMemo(() => items.filter((item) => selected[item.id]), [items, selected]);
  const selectedImageCount = selectedItems.filter((item) => item.imageDataUrl).length;

  const runBackendCheck = useCallback(async () => {
    setIsCheckingBackend(true);
    try {
      const result = await checkMangaImageBackendFn();
      setBackendStatus(result);
    } catch (error) {
      setBackendStatus({
        ok: false,
        backendUrl: "unknown",
        appTokenConfigured: false,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "AI backend check failed.",
      });
    } finally {
      setIsCheckingBackend(false);
    }
  }, [checkMangaImageBackendFn]);

  useEffect(() => {
    void runBackendCheck();
  }, [runBackendCheck]);

  const importFiles = async (files: FileList | File[], forcedRole?: Role) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    setIsImporting(true);
    try {
      const role = forcedRole ?? uploadRole;
      const imported = await Promise.all(
        imageFiles.slice(0, 8).map(async (file) => {
          const image = await readImageAsDataUrl(file);
          return {
            id: createId("asset"),
            name: fileBaseName(file.name),
            role,
            thumbHue: hueFromName(file.name),
            imageDataUrl: image.dataUrl,
            mimeType: image.mimeType,
            characterId: role === "Character" ? activeCharacterId : undefined,
            description: "",
          } satisfies StoredItem;
        }),
      );
      setItems((current) => [...imported, ...current]);
      setSelected((current) => ({
        ...current,
        ...Object.fromEntries(imported.map((item) => [item.id, true])),
      }));
    } finally {
      setIsImporting(false);
    }
  };

  const addCharacter = () => {
    const nextIndex = characters.length + 1;
    const character = {
      id: createId("character"),
      name: `Character ${nextIndex}`,
      storyRole: "Story role",
      identityLock: "Distinctive face, hairstyle, outfit, silhouette, and key traits.",
      defaultExpression: "Neutral expression.",
    };
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
      Array.from({ length: nextCount }, (_, index) => current[index] ?? `Panel ${index + 1}:`),
    );
  };

  const requestImageGeneration = async (operation: GenerationOperation) => {
    setGenerationError(null);
    setIsGenerating(true);

    try {
      const status = backendStatus?.ok ? backendStatus : await checkMangaImageBackendFn();
      setBackendStatus(status);
      if (!status.ok) {
        throw new Error(status.error || "AI backend is not ready yet.");
      }

      const result = await generateMangaImageFn({
        data: {
          operation,
          prompt,
          editPrompt,
          editScope,
          activePage: 1,
          pages: [1],
          panelCount,
          panelInstructions,
          selectedAssets: selectedItems.map((item) => {
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
          existingImageDataUrl: generationResult?.imageUrl,
        },
      });
      setGenerationResult(result);
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
            onClick={addCharacter}
            className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-border bg-surface-2 px-3 text-[13px] font-bold text-text-primary hover:border-accent hover:text-accent"
          >
            <Plus className="h-4 w-4" />
            Add character
          </button>
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

      <AiBackendBanner
        status={backendStatus}
        isChecking={isCheckingBackend}
        onRefresh={runBackendCheck}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:gap-5 xl:[grid-template-columns:minmax(250px,0.92fr)_minmax(420px,1.45fr)_minmax(280px,1fr)] 2xl:[grid-template-columns:minmax(300px,1fr)_minmax(600px,1.7fr)_minmax(320px,1fr)]">
        <LibraryPanel
          items={items}
          characters={characters}
          selected={selected}
          uploadRole={uploadRole}
          setUploadRole={setUploadRole}
          activeCharacterId={activeCharacterId}
          setActiveCharacterId={setActiveCharacterId}
          isImporting={isImporting}
          importFiles={importFiles}
          toggleSelect={toggleSelect}
          updateItem={updateItem}
          removeItem={removeItem}
        />

        <GenerationPanel
          result={generationResult}
          error={generationError}
          isGenerating={isGenerating}
          selectedItems={selectedItems}
          selectedImageCount={selectedImageCount}
          prompt={prompt}
          onGenerate={() => requestImageGeneration("generate")}
          onRegenerate={() => requestImageGeneration("regenerate")}
          onDownload={downloadGeneratedImage}
        />

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
          selectedItems={selectedItems}
          styleMode={styleMode}
          setStyleMode={setStyleMode}
          backgroundLevel={backgroundLevel}
          setBackgroundLevel={setBackgroundLevel}
          readingDirection={readingDirection}
          setReadingDirection={setReadingDirection}
          hasResult={Boolean(generationResult)}
          isGenerating={isGenerating}
          onGenerate={() => requestImageGeneration("generate")}
          onApplyEdit={() => requestImageGeneration("edit")}
        />
      </div>
    </div>
  );
}

function AiBackendBanner({
  status,
  isChecking,
  onRefresh,
}: {
  status: MangaBackendStatusResult | null;
  isChecking: boolean;
  onRefresh: () => void;
}) {
  const ready = status?.ok;
  const message = isChecking
    ? "Checking PulseNote AI backend..."
    : ready
      ? `AI backend ready: ${status.manga?.imageModel ?? "image model"} / ${
          status.manga?.imageSize ?? "default size"
        }`
      : status?.error || "AI backend status has not been checked yet.";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border px-4 py-3 ${
        ready ? "border-accent-border bg-accent-soft/40" : "border-border bg-surface-2"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border ${
            ready
              ? "border-accent-border bg-accent-soft text-accent"
              : "border-border bg-surface-3 text-text-secondary"
          }`}
        >
          {isChecking ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : ready ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-text-primary">{message}</p>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            Backend: {status?.backendUrl ?? "waiting for check"}{" "}
            {status?.appTokenConfigured === false ? " / token missing" : ""}
          </p>
        </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={isChecking}
        className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-border bg-surface-3 px-3 text-[12px] font-bold text-text-secondary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
        Check AI
      </button>
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

function LibraryPanel({
  items,
  characters,
  selected,
  uploadRole,
  setUploadRole,
  activeCharacterId,
  setActiveCharacterId,
  isImporting,
  importFiles,
  toggleSelect,
  updateItem,
  removeItem,
}: {
  items: StoredItem[];
  characters: CharacterProfile[];
  selected: Record<string, boolean>;
  uploadRole: Role;
  setUploadRole: (role: Role) => void;
  activeCharacterId: string;
  setActiveCharacterId: (id: string) => void;
  isImporting: boolean;
  importFiles: (files: FileList | File[], forcedRole?: Role) => void;
  toggleSelect: (id: string) => void;
  updateItem: (id: string, patch: Partial<StoredItem>) => void;
  removeItem: (id: string) => void;
}) {
  return (
    <PanelCard className="xl:max-h-[calc(100vh-165px)]">
      <SectionHeader icon={Layers} title="Image library" count={items.length} />
      <div className="scroll-dark flex-1 overflow-y-auto p-4">
        <ImageImporter
          uploadRole={uploadRole}
          setUploadRole={setUploadRole}
          characters={characters}
          activeCharacterId={activeCharacterId}
          setActiveCharacterId={setActiveCharacterId}
          isImporting={isImporting}
          importFiles={importFiles}
        />

        <div className="mt-4 flex flex-col gap-3">
          {items.length === 0 ? (
            <EmptyState icon={ImageIcon} title="No images imported" />
          ) : (
            items.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                characters={characters}
                selected={!!selected[item.id]}
                toggleSelect={() => toggleSelect(item.id)}
                updateItem={(patch) => updateItem(item.id, patch)}
                removeItem={() => removeItem(item.id)}
              />
            ))
          )}
        </div>
      </div>
    </PanelCard>
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
            className="h-9 rounded-[10px] border border-border bg-input px-2 text-[12px] font-semibold text-text-primary outline-none focus:border-accent"
          >
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
  selectedItems,
  selectedImageCount,
  prompt,
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
  onGenerate: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  return (
    <PanelCard className="xl:max-h-[calc(100vh-165px)]">
      <SectionHeader icon={FileImage} title="Generated page" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-border bg-surface-3 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-[12px] font-bold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {selectedImageCount} image refs
          </span>
          <div className="flex items-center gap-2">
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

        <div className="my-4 flex flex-1 items-center justify-center rounded-[18px] bg-stage p-4">
          <div className="relative flex h-full max-h-[680px] w-full max-w-[500px] items-center justify-center">
            <div className="relative aspect-[210/297] w-full overflow-hidden rounded-[10px] bg-artboard shadow-[0_30px_60px_-20px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)]">
              {isGenerating ? (
                <div className="flex h-full flex-col items-center justify-center bg-[#f7faff] px-8 text-center text-[#0b1430]">
                  <Sparkles className="mb-4 h-10 w-10 animate-pulse" />
                  <p className="text-[16px] font-bold">Generating manga page</p>
                  <p className="mt-2 max-w-[320px] text-[12px] leading-5 text-[#5e6a90]">
                    Prompt locks and selected images are being sent to PulseNote.
                  </p>
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center bg-[#f7faff] px-8 text-center text-[#0b1430]">
                  <X className="mb-4 h-10 w-10 text-danger" />
                  <p className="text-[16px] font-bold">Generation failed</p>
                  <p className="mt-2 max-w-[340px] text-[12px] leading-5 text-[#5e6a90]">{error}</p>
                </div>
              ) : result ? (
                <img
                  src={result.imageUrl}
                  alt="Generated manga page"
                  className="h-full w-full object-contain"
                />
              ) : (
                <MangaPagePlaceholder />
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-border bg-surface-3 p-3">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-text-primary">
            <BookImage className="h-4 w-4 text-accent" />
            Selected references
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-[12px] text-text-muted">No selected image yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {selectedItems.slice(0, 8).map((item) => (
                <div key={item.id} className="min-w-0">
                  <AssetThumb item={item} sizeClass="aspect-square h-auto w-full" />
                  <p className="mt-1 truncate text-[10px] font-semibold text-text-secondary">
                    {item.role}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

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
  selectedItems: StoredItem[];
  styleMode: "auto" | "black-white" | "color";
  setStyleMode: (style: "auto" | "black-white" | "color") => void;
  backgroundLevel: "auto" | "empty" | "minimal" | "detailed";
  setBackgroundLevel: (level: "auto" | "empty" | "minimal" | "detailed") => void;
  readingDirection: "right-to-left" | "left-to-right";
  setReadingDirection: (direction: "right-to-left" | "left-to-right") => void;
  hasResult: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onApplyEdit: () => void;
}) {
  return (
    <PanelCard className="xl:max-h-[calc(100vh-165px)]">
      <div className="flex items-center gap-1 border-b border-border p-3">
        {(
          [
            { id: "prompt", label: "Prompt" },
            { id: "characters", label: "Characters" },
            { id: "references", label: "Refs" },
            { id: "panels", label: "Panels" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => props.setTab(tab.id)}
            className={`h-[38px] flex-1 rounded-[12px] px-2 text-[12px] font-bold transition ${
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
        {props.tab === "prompt" && <PromptTab {...props} />}
        {props.tab === "characters" && <CharactersTab {...props} />}
        {props.tab === "references" && <ReferencesSummary selectedItems={props.selectedItems} />}
        {props.tab === "panels" && <PanelsTab {...props} />}
      </div>

      <div className="space-y-2 border-t border-border p-4">
        <button
          onClick={props.onGenerate}
          disabled={props.isGenerating || !props.prompt.trim()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {props.isGenerating ? "Generating..." : "Generate Final Page"}
        </button>
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
  selectedItems,
  hasResult,
}: Parameters<typeof WorkspacePanel>[0]) {
  const counts = selectedItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = (acc[item.role] || 0) + 1;
    return acc;
  }, {});

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
        <div className="rounded-[14px] border border-border bg-surface-3 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Selected inputs
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(counts).length === 0 ? (
              <span className="text-[12px] text-text-muted">None</span>
            ) : (
              Object.entries(counts).map(([role, count]) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary"
                >
                  <Check className="h-3 w-3 text-accent" />
                  {count} {role}
                </span>
              ))
            )}
          </div>
        </div>
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
  updateCharacter,
  addCharacter,
}: Parameters<typeof WorkspacePanel>[0]) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={addCharacter}
        className="flex h-10 items-center justify-center gap-2 rounded-[12px] border border-border bg-surface-3 text-[13px] font-bold text-text-primary hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" />
        Add character profile
      </button>
      {characters.map((character) => (
        <div key={character.id} className="rounded-[14px] border border-border bg-surface-3 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-accent-border bg-accent-soft text-accent">
              <User className="h-4 w-4" />
            </span>
            <input
              value={character.name}
              onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-border bg-input px-3 text-[13px] font-bold text-text-primary outline-none focus:border-accent"
            />
          </div>
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
        </div>
      ))}
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
