import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  generateMangaImage,
  type MangaImageGenerationResult,
  type MangaImageGenerationInput,
} from "@/server-functions/manga-image";
import {
  Pen,
  Brush,
  Eraser,
  Minus,
  Square,
  Circle,
  ImagePlus,
  Undo2,
  Redo2,
  ZoomIn,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Download,
  RefreshCw,
  Sparkles,
  Check,
  X,
  Upload,
  ImageIcon,
  User,
  Mountain,
  Package,
  BookImage,
  Layers,
  FileImage,
  Lightbulb,
  PencilRuler,
  ChevronDown,
  History,
} from "lucide-react";

export const Route = createFileRoute("/ai/manga-page")({
  head: () => ({
    meta: [
      { title: "CollabManga AI — AI Manga Page Workspace" },
      {
        name: "description",
        content:
          "Professional AI workspace to compose, generate, and refine manga pages with assets, references, and prompts.",
      },
      { property: "og:title", content: "CollabManga AI" },
      {
        property: "og:description",
        content: "AI-assisted manga page creation workspace.",
      },
    ],
  }),
  component: CollabMangaAIPage,
});

type Role = "Character" | "Background" | "Object" | "Reference" | "Generated Page";

type StoredItem = {
  id: string;
  name: string;
  role: Role;
  thumbHue: number;
};

type GenerationOperation = MangaImageGenerationInput["operation"];

const initialItems: StoredItem[] = [
  { id: "i1", name: "Akira — Hero", role: "Character", thumbHue: 200 },
  { id: "i2", name: "Yuki — Rival", role: "Character", thumbHue: 320 },
  { id: "i3", name: "Neo-Tokyo Rooftop", role: "Background", thumbHue: 250 },
  { id: "i4", name: "Rainy Alleyway", role: "Background", thumbHue: 220 },
  { id: "i5", name: "Katana", role: "Object", thumbHue: 140 },
  { id: "i6", name: "Pose Sheet — Action", role: "Reference", thumbHue: 30 },
];

export default function CollabMangaAIPage() {
  const generateMangaImageFn = useServerFn(generateMangaImage);
  const [mode, setMode] = useState<"prepare" | "result">("prepare");
  const [tab, setTab] = useState<"assets" | "references" | "prompt">("prompt");
  const [editScope, setEditScope] = useState<"single" | "full">("single");
  const [items, setItems] = useState<StoredItem[]>(initialItems);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    i1: true,
    i3: true,
    i5: true,
  });
  const [activePage, setActivePage] = useState(2);
  const [pages] = useState([1, 2, 3, 4]);
  const [prompt, setPrompt] = useState(
    "A rooftop confrontation at dusk. Akira draws his katana as Yuki steps from the shadows. Dynamic 6-panel layout, cinematic angles, heavy ink shading.",
  );
  const [editPrompt, setEditPrompt] = useState("");
  const [generationResult, setGenerationResult] = useState<MangaImageGenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedItems = useMemo(() => items.filter((i) => selected[i.id]), [items, selected]);

  const toggleSelect = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const removeItem = (id: string) => {
    setItems((arr) => arr.filter((i) => i.id !== id));
    setSelected((s) => {
      const { [id]: _, ...rest } = s;
      return rest;
    });
  };

  const requestImageGeneration = async (operation: GenerationOperation) => {
    setMode("result");
    setGenerationError(null);
    setIsGenerating(true);

    try {
      const result = await generateMangaImageFn({
        data: {
          operation,
          prompt,
          editPrompt,
          editScope,
          activePage,
          pages,
          panelCount: 6,
          selectedAssets: selectedItems,
          existingImageDataUrl: generationResult?.imageUrl,
        },
      });
      setGenerationResult(result);
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
    link.download = `collabmanga-page-${activePage}.png`;
    link.click();
  };

  return (
    <div className="manga-canvas-page w-full text-text-primary">
      <div className="w-full">
        {/* Page intro — not a hero/header, just a contextual page title */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-bold leading-9">CollabManga AI</h1>
            <p className="mt-1 text-[13px] text-text-secondary">
              Compose, generate, and refine your manga page with AI.
            </p>
          </div>
          <ModeToggle mode={mode} setMode={setMode} />
        </div>

        {/* 3-column workspace */}
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:gap-5 xl:[grid-template-columns:minmax(220px,0.82fr)_minmax(390px,1.55fr)_minmax(230px,0.9fr)] 2xl:gap-6 2xl:[grid-template-columns:minmax(270px,1fr)_minmax(560px,2fr)_minmax(270px,1fr)]">
          <LeftPanel
            items={items}
            selected={selected}
            toggleSelect={toggleSelect}
            removeItem={removeItem}
            mode={mode}
          />
          <CenterPanel
            mode={mode}
            activePage={activePage}
            setActivePage={setActivePage}
            pages={pages}
            generationResult={generationResult}
            generationError={generationError}
            isGenerating={isGenerating}
            onDownload={downloadGeneratedImage}
            onRegenerate={() => requestImageGeneration("regenerate")}
          />
          <RightPanel
            mode={mode}
            tab={tab}
            setTab={setTab}
            editScope={editScope}
            setEditScope={setEditScope}
            prompt={prompt}
            setPrompt={setPrompt}
            editPrompt={editPrompt}
            setEditPrompt={setEditPrompt}
            selectedItems={selectedItems}
            onGenerate={() => requestImageGeneration("generate")}
            onApplyEdit={() => requestImageGeneration("edit")}
            onRegenerate={() => requestImageGeneration("regenerate")}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Mode toggle (state demo control) ---------------- */
function ModeToggle({
  mode,
  setMode,
}: {
  mode: "prepare" | "result";
  setMode: (m: "prepare" | "result") => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1">
      <button
        onClick={() => setMode("prepare")}
        className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition ${
          mode === "prepare"
            ? "bg-accent text-accent-foreground"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        Preparation
      </button>
      <button
        onClick={() => setMode("result")}
        className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition ${
          mode === "result"
            ? "bg-accent text-accent-foreground"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        Result
      </button>
    </div>
  );
}

/* ---------------- Shared building blocks ---------------- */
function PanelCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`shadow-panel flex flex-col rounded-[22px] border border-border bg-surface-2 ${className}`}
    >
      {children}
    </section>
  );
}

function Thumb({ hue, label }: { hue: number; label?: string }) {
  return (
    <div
      className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[12px] border border-border"
      style={{
        background: `radial-gradient(120% 100% at 20% 10%, hsl(${hue} 70% 55% / 0.55), transparent 60%), radial-gradient(120% 100% at 90% 90%, hsl(${(hue + 60) % 360} 60% 35% / 0.65), transparent 55%), linear-gradient(135deg, #0e1736, #101b3f)`,
      }}
    >
      <div className="absolute inset-0 opacity-50 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.06)_0_1px,transparent_1px_6px)]" />
      {label ? (
        <div className="absolute inset-x-1 bottom-1 truncate rounded-md bg-black/40 px-1.5 py-0.5 text-center text-[10px] font-semibold text-text-primary">
          {label}
        </div>
      ) : null}
    </div>
  );
}

function RoleChip({ role, selected }: { role: Role; selected?: boolean }) {
  const roleIcon: Record<Role, React.ReactNode> = {
    Character: <User className="h-3 w-3" />,
    Background: <Mountain className="h-3 w-3" />,
    Object: <Package className="h-3 w-3" />,
    Reference: <BookImage className="h-3 w-3" />,
    "Generated Page": <Sparkles className="h-3 w-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        selected
          ? "border-accent-border bg-accent-soft text-accent"
          : "border-border bg-surface-3 text-text-secondary"
      }`}
    >
      {roleIcon[role]}
      {role}
    </span>
  );
}

function IconBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-[12px] border transition ${
        active
          ? "border-accent-border bg-accent-soft text-accent"
          : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* ---------------- LEFT PANEL ---------------- */
function LeftPanel({
  items,
  selected,
  toggleSelect,
  removeItem,
  mode,
}: {
  items: StoredItem[];
  selected: Record<string, boolean>;
  toggleSelect: (id: string) => void;
  removeItem: (id: string) => void;
  mode: "prepare" | "result";
}) {
  const active = items.filter((i) => selected[i.id]);
  const showGenerated = mode === "result";

  return (
    <PanelCard className="xl:max-h-[calc(100vh-160px)]">
      <header className="flex items-center justify-between gap-2 border-b border-border p-5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <h2 className="font-display text-base font-bold">Selected Elements</h2>
        </div>
        <span className="rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
          {active.length + (showGenerated ? 1 : 0)} active
        </span>
      </header>

      <div className="scroll-dark flex-1 overflow-y-auto p-5 pt-4">
        {/* Active Selection */}
        <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-text-muted">
          Active Selection
        </h3>

        <div className="flex flex-col gap-3">
          {showGenerated && <GeneratedPageCard />}

          {active.length === 0 && !showGenerated ? (
            <EmptyActive />
          ) : (
            active.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                selected
                onToggle={() => toggleSelect(item.id)}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </div>

        {/* Stored Elements */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
              Stored Elements
            </h3>
            <span className="text-[11px] font-semibold text-text-disabled">
              {items.length} items
            </span>
          </div>

          {items.length === 0 ? (
            <EmptyStored />
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  selected={!!selected[item.id]}
                  onToggle={() => toggleSelect(item.id)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PanelCard>
  );
}

function GeneratedPageCard() {
  return (
    <div
      className="glow-accent shadow-elevated relative flex items-center gap-3 rounded-[16px] border border-accent-border bg-surface-3 p-3"
      role="group"
      aria-label="Generated manga page"
    >
      <MangaThumb size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-bold text-text-primary">Generated Page · v3</p>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-text-secondary">Final result · just now</p>
        <div className="mt-2 flex items-center gap-2">
          <RoleChip role="Generated Page" selected />
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            <Check className="h-3 w-3" /> In use
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemCard({
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
      className={`group relative flex min-h-[92px] items-center gap-3 rounded-[16px] border p-3 transition ${
        selected
          ? "glow-accent border-accent-border bg-surface-3"
          : "border-border bg-surface-2 hover:border-border-strong"
      }`}
    >
      <Thumb hue={item.thumbHue} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-text-primary">{item.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <RoleChip role={item.role} selected={selected} />
          {selected && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
              <Check className="h-3 w-3" /> Selected
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
          className="rounded-md p-1 text-text-muted opacity-0 transition hover:bg-surface-3 hover:text-danger group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          aria-pressed={selected}
          className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
            selected
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border-strong text-transparent hover:border-accent"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyActive() {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-surface-3/50 p-5 text-center">
      <FileImage className="mx-auto mb-2 h-5 w-5 text-text-muted" />
      <p className="text-[13px] font-semibold text-text-secondary">No selected elements yet</p>
      <p className="mt-1 text-[12px] text-text-muted">
        Selected items appear here and feed the AI.
      </p>
    </div>
  );
}

function EmptyStored() {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-surface-3/50 p-5 text-center">
      <ImageIcon className="mx-auto mb-2 h-5 w-5 text-text-muted" />
      <p className="text-[13px] font-semibold text-text-secondary">Your library is empty</p>
      <p className="mt-1 text-[12px] text-text-muted">
        Imported assets, generated pages, and visual elements will appear here.
      </p>
    </div>
  );
}

/* ---------------- CENTER PANEL ---------------- */
function CenterPanel({
  mode,
  activePage,
  setActivePage,
  pages,
  generationResult,
  generationError,
  isGenerating,
  onDownload,
  onRegenerate,
}: {
  mode: "prepare" | "result";
  activePage: number;
  setActivePage: (n: number) => void;
  pages: number[];
  generationResult: MangaImageGenerationResult | null;
  generationError: string | null;
  isGenerating: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
}) {
  return (
    <PanelCard className="xl:max-h-[calc(100vh-160px)]">
      <div className="flex h-full flex-col p-5">
        {mode === "prepare" ? (
          <>
            <TopToolbar />
            <div className="my-4 flex flex-1 items-center justify-center rounded-[18px] bg-stage p-6">
              <Artboard />
            </div>
            <BottomToolbar activePage={activePage} setActivePage={setActivePage} pages={pages} />
          </>
        ) : (
          <ResultView
            result={generationResult}
            error={generationError}
            isGenerating={isGenerating}
            onDownload={onDownload}
            onRegenerate={onRegenerate}
          />
        )}
      </div>
    </PanelCard>
  );
}

function TopToolbar() {
  const [tool, setTool] = useState("pen");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-surface-3 px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        {[
          { id: "pen", icon: Pen, label: "Pen" },
          { id: "brush", icon: Brush, label: "Brush" },
          { id: "eraser", icon: Eraser, label: "Eraser" },
          { id: "line", icon: Minus, label: "Line" },
          { id: "rect", icon: Square, label: "Rectangle" },
          { id: "ellipse", icon: Circle, label: "Ellipse" },
        ].map((t) => (
          <IconBtn
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={tool === t.id}
            onClick={() => setTool(t.id)}
          />
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <IconBtn icon={ImagePlus} label="Import image" />
        <IconBtn icon={Undo2} label="Undo" />
        <IconBtn icon={Redo2} label="Redo" />
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-[12px] border border-border bg-surface-2 px-3 py-1.5 md:flex">
          <span className="text-[12px] font-semibold text-text-muted">Stroke</span>
          <div className="h-1 w-20 rounded-full bg-border">
            <div className="h-full w-2/5 rounded-full bg-accent" />
          </div>
          <span className="text-[12px] font-semibold text-text-secondary">4px</span>
        </div>
        <IconBtn icon={ZoomIn} label="Zoom" />
        <IconBtn icon={Maximize2} label="Fit to page" />
      </div>
    </div>
  );
}

function Artboard() {
  return (
    <div className="relative flex h-full max-h-[640px] w-full max-w-[460px] items-center justify-center">
      <div
        className="relative aspect-[210/297] w-full rounded-[10px] bg-artboard shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)]"
        aria-label="Manga page artboard"
      >
        {/* Faint panel layout guides */}
        <svg viewBox="0 0 210 297" className="absolute inset-0 h-full w-full p-3" aria-hidden>
          <g fill="none" stroke="#0e1736" strokeWidth="0.6" opacity="0.35">
            <rect x="6" y="6" width="92" height="80" rx="2" />
            <rect x="106" y="6" width="98" height="80" rx="2" />
            <rect x="6" y="94" width="198" height="60" rx="2" />
            <rect x="6" y="162" width="60" height="60" rx="2" />
            <rect x="74" y="162" width="130" height="60" rx="2" />
            <rect x="6" y="230" width="198" height="60" rx="2" />
          </g>
          <g fill="#7f8cb3" opacity="0.5" fontFamily="Manrope" fontSize="5">
            <text x="105" y="150" textAnchor="middle">
              Page 02 · Composition
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function BottomToolbar({
  activePage,
  setActivePage,
  pages,
}: {
  activePage: number;
  setActivePage: (n: number) => void;
  pages: number[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-surface-3 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <IconBtn icon={ChevronLeft} label="Previous page" />
        <div className="flex items-center gap-1.5">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setActivePage(p)}
              className={`h-8 min-w-8 rounded-[10px] px-2 text-[12px] font-bold transition ${
                p === activePage
                  ? "bg-accent text-accent-foreground"
                  : "border border-border bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              {String(p).padStart(2, "0")}
            </button>
          ))}
          <button
            className="flex h-8 items-center gap-1 rounded-[10px] border border-dashed border-border-strong px-2 text-[12px] font-bold text-text-secondary hover:border-accent hover:text-accent"
            aria-label="Add page"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <IconBtn icon={ChevronRight} label="Next page" />
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-[12px] font-semibold text-text-muted md:inline">
          Page {String(activePage).padStart(2, "0")} of {pages.length}
        </span>
        <IconBtn icon={Copy} label="Duplicate page" />
        <IconBtn icon={Trash2} label="Delete page" />
        <div className="mx-1 hidden h-6 w-px bg-border md:block" />
        <button className="hidden h-9 items-center gap-1.5 rounded-[12px] border border-border bg-surface-2 px-3 text-[12px] font-semibold text-text-secondary hover:text-text-primary md:inline-flex">
          <Maximize2 className="h-3.5 w-3.5" /> Fit width
        </button>
        <span className="hidden rounded-[10px] border border-border bg-surface-2 px-2 py-1 text-[12px] font-semibold text-text-secondary md:inline">
          100%
        </span>
      </div>
    </div>
  );
}

/* ---------- Result Mode (Mode B) center ---------- */
function ResultView({
  result,
  error,
  isGenerating,
  onDownload,
  onRegenerate,
}: {
  result: MangaImageGenerationResult | null;
  error: string | null;
  isGenerating: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-surface-3 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-[12px] font-bold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {isGenerating ? "Generating" : result ? "Generated" : "Preview"}
          </span>
          <span className="text-[12px] font-semibold text-text-muted">
            {result ? `${result.model} · ${result.size}` : "Page 02 · 1024x1536"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn icon={ZoomIn} label="Zoom" />
          <IconBtn icon={Maximize2} label="Fit to screen" />
          <IconBtn icon={Download} label="Download" onClick={onDownload} />
          <IconBtn icon={RefreshCw} label="Regenerate" onClick={onRegenerate} />
        </div>
      </div>

      <div className="my-4 flex flex-1 items-center justify-center rounded-[18px] bg-stage p-6">
        <div className="relative flex h-full max-h-[680px] w-full max-w-[500px] items-center justify-center">
          <div className="relative aspect-[210/297] w-full overflow-hidden rounded-[10px] bg-artboard shadow-[0_30px_60px_-20px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)]">
            {isGenerating ? (
              <div className="flex h-full flex-col items-center justify-center bg-[#f7faff] px-8 text-center text-[#0b1430]">
                <Sparkles className="mb-4 h-10 w-10 animate-pulse text-[#0b1430]" />
                <p className="text-[16px] font-bold">Generating manga page</p>
                <p className="mt-2 max-w-[300px] text-[12px] leading-5 text-[#5e6a90]">
                  Building prompt locks, sending the request to OpenAI, and waiting for the image
                  result.
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
              <MangaPagePreview interactive />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[16px] border border-border bg-surface-3 px-3.5 py-3 text-[12px] text-text-secondary">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          <span>
            {result
              ? `Prompt plan applied · ${result.taskType.replaceAll("_", " ")}`
              : "Hover a panel to highlight · Click to select for single-panel edit"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5" />
          <span>{result ? new Date(result.createdAt).toLocaleTimeString() : "3 versions"}</span>
        </div>
      </div>
    </div>
  );
}

/* SVG manga page preview (placeholder for the AI result) */
function MangaPagePreview({ interactive }: { interactive?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const panels = [
    { x: 4, y: 4, w: 60, h: 50 },
    { x: 68, y: 4, w: 68, h: 50 },
    { x: 4, y: 58, w: 132, h: 40 },
    { x: 4, y: 102, w: 40, h: 44 },
    { x: 48, y: 102, w: 88, h: 44 },
    { x: 4, y: 150, w: 132, h: 50 },
  ];
  return (
    <svg viewBox="0 0 140 204" className="h-full w-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2b5e" />
          <stop offset="1" stopColor="#c44569" />
        </linearGradient>
        <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b1430" />
          <stop offset="1" stopColor="#1a1a2e" />
        </linearGradient>
        <pattern id="dots" width="2" height="2" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.4" fill="#1a1a2e" opacity="0.5" />
        </pattern>
      </defs>

      {/* Panel 1 — wide shot */}
      <g>
        <rect {...panels[0]} fill="url(#sky)" />
        <polygon points="4,42 14,32 24,38 36,28 46,34 60,30 60,54 4,54" fill="#0b1430" />
        <circle cx="50" cy="18" r="4" fill="#ffd166" opacity="0.9" />
      </g>

      {/* Panel 2 — character close-up */}
      <g>
        <rect {...panels[1]} fill="url(#ink)" />
        <rect {...panels[1]} fill="url(#dots)" opacity="0.4" />
        <path
          d="M 100 14 Q 110 8 120 18 Q 124 30 118 42 Q 110 50 100 46 Q 92 38 96 24 Z"
          fill="#f7faff"
          opacity="0.92"
        />
        <path
          d="M 102 24 L 108 26 M 112 26 L 118 24"
          stroke="#0b1430"
          strokeWidth="1.2"
          fill="none"
        />
        <path d="M 104 36 Q 108 40 114 36" stroke="#0b1430" strokeWidth="1.2" fill="none" />
      </g>

      {/* Panel 3 — action wide */}
      <g>
        <rect {...panels[2]} fill="#0b1430" />
        <g stroke="#f7faff" strokeWidth="0.6" opacity="0.7">
          <line x1="20" y1="60" x2="130" y2="96" />
          <line x1="20" y1="65" x2="130" y2="92" />
          <line x1="20" y1="70" x2="130" y2="88" />
          <line x1="20" y1="75" x2="130" y2="84" />
        </g>
        <path d="M 50 78 L 86 70 L 92 82 L 56 90 Z" fill="#f7faff" opacity="0.95" />
        <path d="M 70 60 L 100 68" stroke="#39FF88" strokeWidth="1.4" opacity="0.9" />
      </g>

      {/* Panel 4 — small reaction */}
      <g>
        <rect {...panels[3]} fill="url(#ink)" />
        <circle cx="24" cy="124" r="10" fill="#f7faff" opacity="0.9" />
        <path
          d="M 20 122 L 22 124 M 26 122 L 28 124 M 22 128 Q 24 130 26 128"
          stroke="#0b1430"
          strokeWidth="0.8"
          fill="none"
        />
      </g>

      {/* Panel 5 — dialogue */}
      <g>
        <rect {...panels[4]} fill="#f7faff" />
        <rect {...panels[4]} fill="url(#dots)" opacity="0.3" />
        <rect
          x="56"
          y="110"
          width="72"
          height="28"
          rx="3"
          fill="#ffffff"
          stroke="#0b1430"
          strokeWidth="0.5"
        />
        <text
          x="92"
          y="122"
          textAnchor="middle"
          fontFamily="Manrope"
          fontSize="4.5"
          fontWeight="700"
          fill="#0b1430"
        >
          So you finally came,
        </text>
        <text
          x="92"
          y="130"
          textAnchor="middle"
          fontFamily="Manrope"
          fontSize="4.5"
          fontWeight="700"
          fill="#0b1430"
        >
          Akira.
        </text>
      </g>

      {/* Panel 6 — splash */}
      <g>
        <rect {...panels[5]} fill="#0b1430" />
        <g stroke="#f7faff" strokeWidth="0.5" opacity="0.6" fill="none">
          <path d="M 70 152 L 30 198" />
          <path d="M 70 152 L 50 198" />
          <path d="M 70 152 L 70 198" />
          <path d="M 70 152 L 90 198" />
          <path d="M 70 152 L 110 198" />
          <path d="M 70 152 L 130 198" />
        </g>
        <path
          d="M 60 168 Q 70 158 84 166 Q 90 178 80 188 Q 68 192 60 184 Q 56 176 60 168 Z"
          fill="#f7faff"
        />
        <path d="M 84 166 L 124 180" stroke="#39FF88" strokeWidth="1.5" />
      </g>

      {/* Gutter overlays */}
      <g fill="none">
        {panels.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} stroke="#0b1430" strokeWidth="1" />
        ))}
      </g>

      {/* Interactive panel highlights */}
      {interactive &&
        panels.map((p, i) => (
          <rect
            key={`hl-${i}`}
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            fill="transparent"
            stroke={hover === i ? "#39FF88" : "transparent"}
            strokeWidth="1.4"
            style={{
              cursor: "pointer",
              filter: hover === i ? "drop-shadow(0 0 4px rgba(57,255,136,0.7))" : undefined,
            }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
    </svg>
  );
}

function MangaThumb({ size = 72 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[10px] border border-accent-border bg-white"
      style={{ width: size, height: size * 1.414 * 0.6, aspectRatio: "210/297" }}
    >
      <div style={{ width: "100%", height: "100%" }}>
        <MangaPagePreview />
      </div>
    </div>
  );
}

/* ---------------- RIGHT PANEL ---------------- */
function RightPanel(props: {
  mode: "prepare" | "result";
  tab: "assets" | "references" | "prompt";
  setTab: (t: "assets" | "references" | "prompt") => void;
  editScope: "single" | "full";
  setEditScope: (s: "single" | "full") => void;
  prompt: string;
  setPrompt: (s: string) => void;
  editPrompt: string;
  setEditPrompt: (s: string) => void;
  selectedItems: StoredItem[];
  onGenerate: () => void;
  onApplyEdit: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <PanelCard className="xl:max-h-[calc(100vh-160px)]">
      {props.mode === "prepare" ? <PrepareRight {...props} /> : <ModifyRight {...props} />}
    </PanelCard>
  );
}

/* ---------- Prepare right (3 tabs) ---------- */
function PrepareRight({
  tab,
  setTab,
  prompt,
  setPrompt,
  selectedItems,
  onGenerate,
  isGenerating,
}: {
  tab: "assets" | "references" | "prompt";
  setTab: (t: "assets" | "references" | "prompt") => void;
  prompt: string;
  setPrompt: (s: string) => void;
  selectedItems: StoredItem[];
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border p-3">
        {(
          [
            { id: "assets", label: "Assets" },
            { id: "references", label: "References" },
            { id: "prompt", label: "Prompt" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative h-[38px] flex-1 rounded-[12px] px-3 text-[13px] font-bold transition ${
              tab === t.id
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="scroll-dark flex-1 overflow-y-auto p-5">
        {tab === "assets" && <AssetsTab />}
        {tab === "references" && <ReferencesTab />}
        {tab === "prompt" && (
          <PromptTab prompt={prompt} setPrompt={setPrompt} selectedItems={selectedItems} />
        )}
      </div>

      {tab === "prompt" && (
        <div className="border-t border-border p-5">
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate Final Page"}
          </button>
          <p className="mt-2 text-center text-[11px] text-text-muted">
            Uses selected assets, references, and prompt.
          </p>
        </div>
      )}
    </div>
  );
}

function UploadZone({ label }: { label: string }) {
  return (
    <button className="group flex w-full flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-border-strong bg-surface-3/40 p-6 transition hover:border-accent hover:bg-accent-soft">
      <Upload className="h-5 w-5 text-text-secondary transition group-hover:text-accent" />
      <p className="text-[13px] font-bold text-text-primary">{label}</p>
      <p className="text-[12px] text-text-muted">Drag &amp; drop or click to browse</p>
    </button>
  );
}

function AssetCard({
  name,
  role,
  hue,
  selected,
}: {
  name: string;
  role: Role;
  hue: number;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[16px] border p-3 transition ${
        selected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3"
      }`}
    >
      <Thumb hue={hue} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold">{name}</p>
        <div className="mt-2 flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary">
            {role}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <button aria-label="Remove" className="rounded-md p-1 text-text-muted hover:text-danger">
          <X className="h-4 w-4" />
        </button>
        <button
          aria-pressed={selected}
          className={`h-6 w-6 rounded-md border ${
            selected ? "border-accent bg-accent text-accent-foreground" : "border-border-strong"
          } flex items-center justify-center`}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function AssetsTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-bold">Assets</h3>
        <p className="mt-1 text-[12px] text-text-secondary">
          Imported images with a functional role used by the AI.
        </p>
      </div>
      <UploadZone label="Import an asset" />
      <div className="flex flex-col gap-3">
        <AssetCard name="Akira — Hero" role="Character" hue={200} selected />
        <AssetCard name="Yuki — Rival" role="Character" hue={320} />
        <AssetCard name="Neo-Tokyo Rooftop" role="Background" hue={250} selected />
        <AssetCard name="Katana" role="Object" hue={140} selected />
      </div>
    </div>
  );
}

function ReferencesTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-bold">References</h3>
        <p className="mt-1 text-[12px] text-text-secondary">
          Visual inspiration for the final page. Different from functional assets.
        </p>
      </div>
      <UploadZone label="Import a reference" />
      <button className="flex items-center justify-center gap-2 rounded-[14px] border border-border bg-surface-3 px-4 py-2.5 text-[13px] font-bold text-text-primary transition hover:border-accent hover:text-accent">
        <PencilRuler className="h-4 w-4" />
        Add current canvas as reference
      </button>
      <div className="grid grid-cols-2 gap-3">
        {[
          { hue: 30, name: "Action poses", sel: true },
          { hue: 280, name: "Neon city" },
          { hue: 10, name: "Ink shading" },
          { hue: 160, name: "Speed lines", sel: true },
        ].map((r, i) => (
          <div
            key={i}
            className={`group relative overflow-hidden rounded-[14px] border ${
              r.sel ? "border-accent-border glow-accent" : "border-border"
            } bg-surface-3 p-2`}
          >
            <div
              className="aspect-[4/5] w-full rounded-[10px]"
              style={{
                background: `radial-gradient(120% 100% at 30% 20%, hsl(${r.hue} 70% 55% / 0.55), transparent 60%), linear-gradient(135deg, #0e1736, #101b3f)`,
              }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-[12px] font-semibold">{r.name}</span>
              {r.sel && <Check className="h-3.5 w-3.5 text-accent" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptTab({
  prompt,
  setPrompt,
  selectedItems,
}: {
  prompt: string;
  setPrompt: (s: string) => void;
  selectedItems: StoredItem[];
}) {
  const counts = selectedItems.reduce<Record<string, number>>((acc, i) => {
    acc[i.role] = (acc[i.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base font-bold">Prompt</h3>
        <p className="mt-1 text-[12px] text-text-secondary">
          AI combines selected assets, references, and your description.
        </p>
      </div>

      <div className="rounded-[14px] border border-border bg-surface-3 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Selected inputs
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary"
            >
              <Check className="h-3 w-3 text-accent" /> {v} {k}
            </span>
          ))}
          {selectedItems.length === 0 && (
            <span className="text-[12px] text-text-muted">Nothing selected yet</span>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="prompt"
          className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-text-muted"
        >
          Describe the page
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          placeholder="Describe scene, mood, panel layout, dialog beats…"
          className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3.5 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="rounded-[14px] border border-border bg-surface-3 p-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          <p className="text-[12px] font-bold text-text-primary">Prompt tips</p>
        </div>
        <ul className="mt-2 space-y-1 text-[12px] text-text-secondary">
          <li>· Mention panel count and reading direction.</li>
          <li>· Describe camera angles and emotion per beat.</li>
          <li>· Reference an inking style: clean, hatching, screentone.</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------- Modify right (Mode B) ---------- */
function ModifyRight({
  editScope,
  setEditScope,
  editPrompt,
  setEditPrompt,
  selectedItems,
  onApplyEdit,
  onRegenerate,
  isGenerating,
}: {
  editScope: "single" | "full";
  setEditScope: (s: "single" | "full") => void;
  editPrompt: string;
  setEditPrompt: (s: string) => void;
  selectedItems: StoredItem[];
  onApplyEdit: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-display text-base font-bold">Modify Result</h2>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            Refine the generated page or a single panel.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          v3
        </span>
      </header>

      <div className="scroll-dark flex-1 overflow-y-auto p-5">
        {/* Segmented scope switch */}
        <div className="rounded-[14px] border border-border bg-surface-3 p-1">
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { id: "single", label: "Edit Single Panel" },
                { id: "full", label: "Edit Full Page" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setEditScope(opt.id)}
                className={`h-10 rounded-[10px] px-2 text-[13px] font-bold transition ${
                  editScope === opt.id
                    ? "bg-accent text-accent-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Context block */}
        <div className="mt-4 rounded-[14px] border border-border bg-surface-3 p-3">
          {editScope === "single" ? (
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-accent-border bg-accent-soft text-accent">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-text-primary">Panel 03 selected</p>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  Click any panel on the page to change selection.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <FileImage className="mt-0.5 h-4 w-4 text-accent" />
              <p className="text-[12px] text-text-secondary">
                Changes will be applied to the entire manga page.
              </p>
            </div>
          )}
        </div>

        {/* Edit prompt */}
        <div className="mt-4">
          <label
            htmlFor="editPrompt"
            className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-text-muted"
          >
            Modification prompt
          </label>
          <textarea
            id="editPrompt"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={5}
            placeholder={
              editScope === "single"
                ? "Describe the change for the selected panel…"
                : "Describe the change for the whole page…"
            }
            className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3.5 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Collapsibles */}
        <Accordion title="Selected Assets" count={3}>
          <div className="flex flex-wrap gap-2">
            {selectedItems.length === 0 && (
              <span className="text-[12px] text-text-muted">No assets selected.</span>
            )}
            {selectedItems.map((i) => (
              <span
                key={i.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-[12px] font-semibold text-text-secondary"
              >
                <Thumb hue={i.thumbHue} />
                <span className="-ml-1 truncate">{i.name}</span>
              </span>
            ))}
          </div>
        </Accordion>

        <Accordion title="Selected References" count={2}>
          <div className="grid grid-cols-3 gap-2">
            {[30, 160, 280].map((h, i) => (
              <div
                key={i}
                className="aspect-square rounded-[10px] border border-border"
                style={{
                  background: `radial-gradient(120% 100% at 30% 20%, hsl(${h} 70% 55% / 0.55), transparent 60%), linear-gradient(135deg, #0e1736, #101b3f)`,
                }}
              />
            ))}
          </div>
        </Accordion>
      </div>

      {/* Sticky actions */}
      <div className="space-y-2 border-t border-border p-5">
        <button
          onClick={onApplyEdit}
          disabled={isGenerating}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" /> {isGenerating ? "Applying..." : "Apply Edit"}
        </button>
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-border-strong bg-transparent px-4 text-[14px] font-bold text-text-primary transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" /> Regenerate
        </button>
        <button className="flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-text-secondary">
          <History className="h-3.5 w-3.5" /> Revert to previous version
        </button>
      </div>
    </div>
  );
}

function Accordion({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-4 rounded-[14px] border border-border bg-surface-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-3"
      >
        <span className="flex items-center gap-2 text-[13px] font-bold">
          {title}
          {typeof count === "number" && (
            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
              {count}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}
