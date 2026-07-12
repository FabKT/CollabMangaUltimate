import { useCallback, useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Pencil,
  Minus,
  Square,
  Circle,
  ImagePlus,
  Undo2,
  Redo2,
  Trash2,
  Eraser,
  Download,
  Layers,
  BookImage,
  FileImage,
  PenTool,
  LayoutTemplate,
  X,
} from "lucide-react";
import { loadSession, saveSession } from "@/lib/manga-session";

/**
 * Dependency-free vector editor used to compose manga "planche" structures.
 *
 * Elements (freehand strokes, lines, rectangles, ellipses, imported images) are
 * stored as plain objects and rendered as SVG, which keeps selection, move and
 * resize interactions simple and makes a clean PNG export straightforward.
 */

type SheetFormat = "single" | "double";
const FORMATS: Record<SheetFormat, { w: number; h: number; label: string; title: string }> = {
  single: { w: 800, h: 1200, label: "2:3", title: "Single page (2:3)" }, // portrait
  double: { w: 1800, h: 1200, label: "3:2", title: "Double spread (3:2)" }, // landscape
};

type PanelRect = { x: number; y: number; w: number; h: number };
type PlancheTemplate = {
  id: string;
  name: string;
  ratio: "2:3" | "3:2";
  format: SheetFormat;
  panels: PanelRect[];
};

function gridPanels(cols: number, rows: number): PanelRect[] {
  const m = 0.05;
  const g = 0.03;
  const w = (1 - 2 * m - (cols - 1) * g) / cols;
  const h = (1 - 2 * m - (rows - 1) * g) / rows;
  const out: PanelRect[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out.push({ x: m + c * (w + g), y: m + r * (h + g), w, h });
    }
  }
  return out;
}

const TEMPLATES: PlancheTemplate[] = [
  { id: "p-blank", name: "Blanche", ratio: "2:3", format: "single", panels: [] },
  { id: "p-2", name: "2 bandes", ratio: "2:3", format: "single", panels: gridPanels(1, 2) },
  { id: "p-3", name: "3 bandes", ratio: "2:3", format: "single", panels: gridPanels(1, 3) },
  { id: "p-4", name: "4 cases", ratio: "2:3", format: "single", panels: gridPanels(2, 2) },
  { id: "p-6", name: "6 cases", ratio: "2:3", format: "single", panels: gridPanels(2, 3) },
  { id: "p-9", name: "9 cases", ratio: "2:3", format: "single", panels: gridPanels(3, 3) },
  {
    id: "p-hero-top",
    name: "Hero haut",
    ratio: "2:3",
    format: "single",
    panels: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.42 },
      { x: 0.05, y: 0.51, w: 0.43, h: 0.2 },
      { x: 0.52, y: 0.51, w: 0.43, h: 0.2 },
      { x: 0.05, y: 0.75, w: 0.9, h: 0.2 },
    ],
  },
  {
    id: "p-hero-bottom",
    name: "Hero bas",
    ratio: "2:3",
    format: "single",
    panels: [
      { x: 0.05, y: 0.05, w: 0.43, h: 0.22 },
      { x: 0.52, y: 0.05, w: 0.43, h: 0.22 },
      { x: 0.05, y: 0.31, w: 0.9, h: 0.22 },
      { x: 0.05, y: 0.57, w: 0.9, h: 0.38 },
    ],
  },
  {
    id: "p-tall-left",
    name: "Colonne",
    ratio: "2:3",
    format: "single",
    panels: [
      { x: 0.05, y: 0.05, w: 0.42, h: 0.9 },
      { x: 0.52, y: 0.05, w: 0.43, h: 0.27 },
      { x: 0.52, y: 0.365, w: 0.43, h: 0.27 },
      { x: 0.52, y: 0.68, w: 0.43, h: 0.27 },
    ],
  },
  {
    id: "p-dialogue",
    name: "Dialogue",
    ratio: "2:3",
    format: "single",
    panels: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.2 },
      { x: 0.05, y: 0.29, w: 0.43, h: 0.22 },
      { x: 0.52, y: 0.29, w: 0.43, h: 0.22 },
      { x: 0.05, y: 0.55, w: 0.58, h: 0.18 },
      { x: 0.67, y: 0.55, w: 0.28, h: 0.18 },
      { x: 0.05, y: 0.77, w: 0.9, h: 0.18 },
    ],
  },
  {
    id: "p-splash",
    name: "Splash",
    ratio: "2:3",
    format: "single",
    panels: [{ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }],
  },
  {
    id: "p-mix",
    name: "Mixte",
    ratio: "2:3",
    format: "single",
    panels: [
      { x: 0.05, y: 0.05, w: 0.9, h: 0.26 },
      { x: 0.05, y: 0.35, w: 0.43, h: 0.26 },
      { x: 0.52, y: 0.35, w: 0.43, h: 0.26 },
      { x: 0.05, y: 0.65, w: 0.9, h: 0.3 },
    ],
  },
  { id: "d-blank", name: "Blanche", ratio: "3:2", format: "double", panels: [] },
  {
    id: "d-4",
    name: "4 cases",
    ratio: "3:2",
    format: "double",
    panels: gridPanels(2, 2),
  },
  { id: "d-6", name: "6 cases", ratio: "3:2", format: "double", panels: gridPanels(3, 2) },
  { id: "d-8", name: "8 cases", ratio: "3:2", format: "double", panels: gridPanels(4, 2) },
  { id: "d-10", name: "10 cases", ratio: "3:2", format: "double", panels: gridPanels(5, 2) },
  {
    id: "d-panorama",
    name: "Panorama",
    ratio: "3:2",
    format: "double",
    panels: [
      { x: 0.04, y: 0.06, w: 0.92, h: 0.36 },
      { x: 0.04, y: 0.48, w: 0.28, h: 0.46 },
      { x: 0.36, y: 0.48, w: 0.28, h: 0.46 },
      { x: 0.68, y: 0.48, w: 0.28, h: 0.46 },
    ],
  },
  {
    id: "d-triptych",
    name: "Triptyque",
    ratio: "3:2",
    format: "double",
    panels: [
      { x: 0.04, y: 0.06, w: 0.28, h: 0.88 },
      { x: 0.36, y: 0.06, w: 0.28, h: 0.88 },
      { x: 0.68, y: 0.06, w: 0.28, h: 0.88 },
    ],
  },
  {
    id: "d-center",
    name: "Centre",
    ratio: "3:2",
    format: "double",
    panels: [
      { x: 0.04, y: 0.06, w: 0.18, h: 0.42 },
      { x: 0.04, y: 0.54, w: 0.18, h: 0.4 },
      { x: 0.25, y: 0.06, w: 0.5, h: 0.88 },
      { x: 0.78, y: 0.06, w: 0.18, h: 0.42 },
      { x: 0.78, y: 0.54, w: 0.18, h: 0.4 },
    ],
  },
  {
    id: "d-dialogue",
    name: "Dialogue",
    ratio: "3:2",
    format: "double",
    panels: [
      { x: 0.04, y: 0.06, w: 0.44, h: 0.22 },
      { x: 0.52, y: 0.06, w: 0.44, h: 0.22 },
      { x: 0.04, y: 0.34, w: 0.28, h: 0.26 },
      { x: 0.36, y: 0.34, w: 0.28, h: 0.26 },
      { x: 0.68, y: 0.34, w: 0.28, h: 0.26 },
      { x: 0.04, y: 0.66, w: 0.92, h: 0.28 },
    ],
  },
  {
    id: "d-splash",
    name: "Splash",
    ratio: "3:2",
    format: "double",
    panels: [{ x: 0.04, y: 0.06, w: 0.92, h: 0.88 }],
  },
  {
    id: "d-spread",
    name: "Spread action",
    ratio: "3:2",
    format: "double",
    panels: [
      { x: 0.04, y: 0.06, w: 0.92, h: 0.2 },
      { x: 0.04, y: 0.3, w: 0.92, h: 0.4 },
      { x: 0.04, y: 0.74, w: 0.44, h: 0.2 },
      { x: 0.52, y: 0.74, w: 0.44, h: 0.2 },
    ],
  },
];

type Tool = "select" | "pen" | "eraser" | "line" | "rect" | "ellipse";
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";

type BaseEl = { id: string; stroke: string; strokeWidth: number };
type PathEl = BaseEl & { type: "path"; points: Point[] };
type EraserEl = { id: string; type: "eraser"; points: Point[]; strokeWidth: number };
type LineEl = BaseEl & { type: "line"; x1: number; y1: number; x2: number; y2: number };
type RectEl = BaseEl & { type: "rect"; x: number; y: number; w: number; h: number };
type EllipseEl = BaseEl & { type: "ellipse"; x: number; y: number; w: number; h: number };
type ImageEl = { id: string; type: "image"; x: number; y: number; w: number; h: number; href: string };
type Element = PathEl | EraserEl | LineEl | RectEl | EllipseEl | ImageEl;

type Interaction =
  | { kind: "draw"; snapshot: Element[]; start: Point }
  | { kind: "move"; id: string; start: Point; orig: Element; snapshot: Element[] }
  | {
      kind: "resize";
      id: string;
      fixed: Point;
      startBox: Box;
      orig: Element;
      snapshot: Element[];
    }
  | null;

const SWATCHES = ["#0b1430", "#ffffff", "#ff5f7e", "#39ff88", "#4ea8ff", "#ffb84d"];
const WIDTHS = [2, 4, 7];

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `el-${Date.now().toString(36)}-${idCounter}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function elementBox(el: Element): Box {
  switch (el.type) {
    case "rect":
    case "ellipse":
    case "image":
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "line":
      return {
        x: Math.min(el.x1, el.x2),
        y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1),
        h: Math.abs(el.y2 - el.y1),
      };
    case "path":
    case "eraser": {
      const xs = el.points.map((p) => p.x);
      const ys = el.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
  }
}

function moveElement(el: Element, dx: number, dy: number): Element {
  switch (el.type) {
    case "rect":
    case "ellipse":
    case "image":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "line":
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "path":
    case "eraser":
      return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
}

function transformElement(el: Element, from: Box, to: Box): Element {
  const sx = from.w === 0 ? 1 : to.w / from.w;
  const sy = from.h === 0 ? 1 : to.h / from.h;
  const mx = (x: number) => to.x + (x - from.x) * sx;
  const my = (y: number) => to.y + (y - from.y) * sy;
  switch (el.type) {
    case "rect":
    case "ellipse":
    case "image":
      return { ...el, x: mx(el.x), y: my(el.y), w: el.w * sx, h: el.h * sy };
    case "line":
      return { ...el, x1: mx(el.x1), y1: my(el.y1), x2: mx(el.x2), y2: my(el.y2) };
    case "path":
    case "eraser":
      return { ...el, points: el.points.map((p) => ({ x: mx(p.x), y: my(p.y) })) };
  }
}

function pathD(points: Point[]) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function elementMarkup(el: Element): string {
  switch (el.type) {
    case "path":
      return `<path d="${pathD(el.points)}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
    case "eraser":
      return `<path d="${pathD(el.points)}" fill="none" stroke="#ffffff" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
    case "line":
      return `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" />`;
    case "rect":
      return `<rect x="${el.x}" y="${el.y}" width="${Math.max(0, el.w)}" height="${Math.max(0, el.h)}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" />`;
    case "ellipse":
      return `<ellipse cx="${el.x + el.w / 2}" cy="${el.y + el.h / 2}" rx="${Math.abs(el.w / 2)}" ry="${Math.abs(el.h / 2)}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" />`;
    case "image":
      return `<image href="${el.href}" x="${el.x}" y="${el.y}" width="${Math.max(0, el.w)}" height="${Math.max(0, el.h)}" preserveAspectRatio="none" />`;
  }
}

function buildSvgString(elements: Element[], w: number, h: number) {
  const body = elements.map(elementMarkup).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff" />${body}</svg>`;
}

async function exportPng(elements: Element[], w: number, h: number): Promise<string> {
  const svg = buildSvgString(elements, w, h);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Canvas export failed."));
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export failed.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function readImageFile(file: File): Promise<{ href: string; ratio: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const href = String(reader.result);
      const probe = new Image();
      probe.onload = () => resolve({ href, ratio: probe.width / probe.height || 1 });
      probe.onerror = () => resolve({ href, ratio: 1 });
      probe.src = href;
    };
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

export function PlancheCanvas({
  onUseAsStructure,
  onUseAsReference,
  hasResult,
  onShowResult,
  title = "Planche canvas",
}: {
  onUseAsStructure: (dataUrl: string) => void;
  onUseAsReference: (dataUrl: string) => void;
  hasResult: boolean;
  onShowResult: () => void;
  title?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [format, setFormat] = useState<SheetFormat>(
    () => loadSession<SheetFormat>("canvas.format") ?? "single",
  );
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [color, setColor] = useState(SWATCHES[0]);
  const [strokeWidth, setStrokeWidth] = useState(WIDTHS[1]);
  const [elements, setElements] = useState<Element[]>(
    () => loadSession<Element[]>("canvas.elements") ?? [],
  );
  const [past, setPast] = useState<Element[][]>([]);
  const [future, setFuture] = useState<Element[][]>([]);
  const [draft, setDraft] = useState<Element | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    saveSession("canvas.elements", elements);
  }, [elements]);
  useEffect(() => {
    saveSession("canvas.format", format);
  }, [format]);

  const commit = useCallback((next: Element[], previous: Element[]) => {
    setPast((p) => [...p, previous]);
    setFuture([]);
    setElements(next);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setFuture((f) => [elements, ...f]);
      setElements(previous);
      setSelectedId(null);
      return p.slice(0, -1);
    });
  }, [elements]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, elements]);
      setElements(next);
      setSelectedId(null);
      return f.slice(1);
    });
  }, [elements]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit(
      elements.filter((el) => el.id !== selectedId),
      elements,
    );
    setSelectedId(null);
  }, [commit, elements, selectedId]);

  const clearAll = useCallback(() => {
    if (elements.length === 0) return;
    commit([], elements);
    setSelectedId(null);
  }, [commit, elements]);

  const applyTemplate = (tpl: PlancheTemplate) => {
    const dims = FORMATS[tpl.format];
    const rects: Element[] = tpl.panels.map((p) => ({
      id: nextId(),
      type: "rect",
      x: p.x * dims.w,
      y: p.y * dims.h,
      w: p.w * dims.w,
      h: p.h * dims.h,
      stroke: "#0b1430",
      strokeWidth: 5,
    }));
    setFormat(tpl.format);
    commit(rects, elements);
    setSelectedId(null);
    setTool("select");
    setTemplatesOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selectedId]);

  const view = FORMATS[format];
  const activeStrokeWidth = tool === "eraser" ? strokeWidth * 5 + 6 : strokeWidth;
  const widestFormatRatio = FORMATS.double.w / FORMATS.double.h;
  const viewRatio = view.w / view.h;
  const sheetHeight =
    stageSize.width > 0 && stageSize.height > 0
      ? Math.max(1, Math.min(stageSize.height, stageSize.width / widestFormatRatio))
      : 0;
  const sheetStyle =
    sheetHeight > 0
      ? {
          width: `${Math.round(sheetHeight * viewRatio)}px`,
          height: `${Math.round(sheetHeight)}px`,
        }
      : {
          aspectRatio: `${view.w} / ${view.h}`,
          height: "100%",
          maxWidth: "100%",
        };

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const syncStageSize = () => {
      const rect = node.getBoundingClientRect();
      const next = {
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      };
      setStageSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    syncStageSize();
    const observer = new ResizeObserver(syncStageSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const toSvg = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * view.w, 0, view.w),
      y: clamp(((clientY - rect.top) / rect.height) * view.h, 0, view.h),
    };
  };

  const beginBackground = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    const p = toSvg(e.clientX, e.clientY);
    svgRef.current?.setPointerCapture(e.pointerId);
    interactionRef.current = { kind: "draw", snapshot: elements, start: p };
    if (tool === "pen") {
      setDraft({ id: nextId(), type: "path", points: [p], stroke: color, strokeWidth });
    } else if (tool === "eraser") {
      setDraft({ id: nextId(), type: "eraser", points: [p], strokeWidth: activeStrokeWidth });
    } else if (tool === "line") {
      setDraft({ id: nextId(), type: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: color, strokeWidth });
    } else if (tool === "rect") {
      setDraft({ id: nextId(), type: "rect", x: p.x, y: p.y, w: 0, h: 0, stroke: color, strokeWidth });
    } else if (tool === "ellipse") {
      setDraft({ id: nextId(), type: "ellipse", x: p.x, y: p.y, w: 0, h: 0, stroke: color, strokeWidth });
    }
  };

  const beginMove = (e: React.PointerEvent, el: Element) => {
    if (tool !== "select") return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setSelectedId(el.id);
    interactionRef.current = {
      kind: "move",
      id: el.id,
      start: toSvg(e.clientX, e.clientY),
      orig: el,
      snapshot: elements,
    };
  };

  const beginResize = (e: React.PointerEvent, el: Element, corner: Corner) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    const box = elementBox(el);
    const fixed: Point = {
      x: corner === "nw" || corner === "sw" ? box.x + box.w : box.x,
      y: corner === "nw" || corner === "ne" ? box.y + box.h : box.y,
    };
    interactionRef.current = { kind: "resize", id: el.id, fixed, startBox: box, orig: el, snapshot: elements };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const p = toSvg(e.clientX, e.clientY);

    if (interaction.kind === "draw") {
      const start = interaction.start;
      setDraft((current) => {
        if (!current) return current;
        if (current.type === "path" || current.type === "eraser") return { ...current, points: [...current.points, p] };
        if (current.type === "line") return { ...current, x2: p.x, y2: p.y };
        return {
          ...current,
          x: Math.min(start.x, p.x),
          y: Math.min(start.y, p.y),
          w: Math.abs(p.x - start.x),
          h: Math.abs(p.y - start.y),
        };
      });
      return;
    }

    if (interaction.kind === "move") {
      const dx = p.x - interaction.start.x;
      const dy = p.y - interaction.start.y;
      const moved = moveElement(interaction.orig, dx, dy);
      setElements((current) => current.map((el) => (el.id === interaction.id ? moved : el)));
      return;
    }

    if (interaction.kind === "resize") {
      const to: Box = {
        x: Math.min(interaction.fixed.x, p.x),
        y: Math.min(interaction.fixed.y, p.y),
        w: Math.max(4, Math.abs(p.x - interaction.fixed.x)),
        h: Math.max(4, Math.abs(p.y - interaction.fixed.y)),
      };
      const resized = transformElement(interaction.orig, interaction.startBox, to);
      setElements((current) => current.map((el) => (el.id === interaction.id ? resized : el)));
    }
  };

  const endInteraction = (e: React.PointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    if (e.pointerId != null) {
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    if (!interaction) return;

    if (interaction.kind === "draw") {
      setDraft((current) => {
        if (current) {
          const box = elementBox(current);
          const trivial =
            ((current.type === "path" || current.type === "eraser") && current.points.length < 2) ||
            (current.type !== "path" && current.type !== "eraser" && box.w < 3 && box.h < 3);
          if (!trivial) {
            setPast((p) => [...p, interaction.snapshot]);
            setFuture([]);
            setElements((els) => [...els, current]);
            setSelectedId(current.type === "eraser" ? null : current.id);
          }
        }
        return null;
      });
      return;
    }

    // move / resize: history entry is the pre-interaction snapshot
    setPast((p) => [...p, interaction.snapshot]);
    setFuture([]);
  };

  const importImage = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const { href, ratio } = await readImageFile(file);
    const w = view.w * 0.5;
    const h = w / (ratio || 1);
    const el: ImageEl = {
      id: nextId(),
      type: "image",
      x: (view.w - w) / 2,
      y: (view.h - h) / 2,
      w,
      h,
      href,
    };
    commit([...elements, el], elements);
    setSelectedId(el.id);
    setTool("select");
  };

  const runExport = async (consume: (dataUrl: string) => void) => {
    setIsExporting(true);
    try {
      const dataUrl = await exportPng(elements, view.w, view.h);
      consume(dataUrl);
    } finally {
      setIsExporting(false);
    }
  };

  const download = () =>
    runExport((dataUrl) => {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `planche-${Date.now()}.png`;
      link.click();
    });

  const selectedEl = elements.find((el) => el.id === selectedId) ?? null;
  const selectionBox = selectedEl ? elementBox(selectedEl) : null;

  const tools: Array<{ id: Tool; icon: typeof Pencil; label: string }> = [
    { id: "select", icon: MousePointer2, label: "Select / move" },
    { id: "pen", icon: Pencil, label: "Draw" },
    { id: "eraser", icon: Eraser, label: "Local eraser" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "ellipse", icon: Circle, label: "Ellipse" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: title + tools on one line */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="mr-1 flex items-center gap-2">
          <PenTool className="h-4 w-4 shrink-0 text-accent" />
          <h2 className="truncate font-display text-base font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              aria-pressed={tool === t.id}
              className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${
                tool === t.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            title="Import image"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void importImage(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-accent" : "border-border"}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setStrokeWidth(w)}
              aria-label={`${tool === "eraser" ? "Eraser" : "Stroke"} ${w}`}
              className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${
                strokeWidth === w
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface-2 hover:border-accent"
              }`}
            >
              <span
                className="rounded-full bg-text-primary"
                style={{
                  width: tool === "eraser" ? Math.min(18, w * 2 + 8) : w + 2,
                  height: tool === "eraser" ? Math.min(18, w * 2 + 8) : w + 2,
                }}
              />
            </button>
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={past.length === 0}
            title="Undo"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Redo"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={deleteSelected}
            disabled={!selectedId}
            title="Delete selection"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-secondary hover:text-danger disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={clearAll}
            disabled={elements.length === 0}
            title="Clear canvas"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-secondary hover:text-danger disabled:opacity-40"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          {(Object.keys(FORMATS) as SheetFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              title={FORMATS[f].title}
              className={`flex h-8 items-center rounded-[9px] border px-2.5 text-[11px] font-bold ${
                format === f
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              {FORMATS[f].label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setTemplatesOpen(true)}
          title="Predefined planches"
          className="flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-surface-2 px-2.5 text-[11px] font-bold text-text-secondary hover:text-text-primary"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
        </button>

        {hasResult && (
          <button
            onClick={onShowResult}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-border bg-surface-2 px-3 text-[12px] font-bold text-text-secondary hover:text-text-primary"
          >
            <FileImage className="h-3.5 w-3.5" />
            View result
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {/* Canvas stage */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[18px] bg-stage p-4">
        <div ref={stageRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <div
          className="relative overflow-hidden rounded-[10px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
          style={sheetStyle}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${view.w} ${view.h}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full"
            style={{ touchAction: "none", cursor: tool === "select" ? "default" : "crosshair" }}
            onPointerDown={beginBackground}
            onPointerMove={onPointerMove}
            onPointerUp={endInteraction}
            onPointerLeave={endInteraction}
          >
            <rect x={0} y={0} width={view.w} height={view.h} fill="#ffffff" />

            {elements.map((el) => (
              <ElementShape
                key={el.id}
                el={el}
                selectable={tool === "select"}
                onPointerDown={(e) => beginMove(e, el)}
              />
            ))}

            {draft && <ElementShape el={draft} selectable={false} />}

            {selectionBox && tool === "select" && selectedEl && (
              <g>
                <rect
                  x={selectionBox.x}
                  y={selectionBox.y}
                  width={selectionBox.w}
                  height={selectionBox.h}
                  fill="none"
                  stroke="#39ff88"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  pointerEvents="none"
                />
                {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => {
                  const hx = corner === "nw" || corner === "sw" ? selectionBox.x : selectionBox.x + selectionBox.w;
                  const hy = corner === "nw" || corner === "ne" ? selectionBox.y : selectionBox.y + selectionBox.h;
                  return (
                    <rect
                      key={corner}
                      x={hx - 8}
                      y={hy - 8}
                      width={16}
                      height={16}
                      fill="#39ff88"
                      stroke="#04111e"
                      strokeWidth={1.5}
                      style={{ cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize" }}
                      onPointerDown={(e) => beginResize(e, selectedEl, corner)}
                    />
                  );
                })}
              </g>
            )}
          </svg>
        </div>
        </div>
      </div>

      {/* Export actions */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          onClick={() => void runExport(onUseAsStructure)}
          disabled={isExporting || elements.length === 0}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Layers className="h-4 w-4" />
          Use as structure
        </button>
        <button
          onClick={() => void runExport(onUseAsReference)}
          disabled={isExporting || elements.length === 0}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-border-strong px-4 text-[13px] font-bold text-text-primary hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <BookImage className="h-4 w-4" />
          Use as reference
        </button>
        <button
          onClick={download}
          disabled={isExporting || elements.length === 0}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-border-strong px-4 text-[13px] font-bold text-text-primary hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>
      </div>

      {templatesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,7,18,0.82)" }}
          onClick={() => setTemplatesOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] border border-border bg-surface-2"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-display text-base font-bold">Predefined planches</h2>
              <button
                onClick={() => setTemplatesOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="scroll-dark min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {(["2:3", "3:2"] as const).map((ratio) => (
                <div key={ratio}>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Planches {ratio}
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {TEMPLATES.filter((t) => t.ratio === ratio).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="flex flex-col items-center gap-2 rounded-[12px] border border-border bg-surface-3 p-2 hover:border-accent"
                      >
                        <TemplatePreview template={t} />
                        <span className="text-center text-[11px] font-semibold text-text-secondary">
                          {t.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplatePreview({ template }: { template: PlancheTemplate }) {
  const h = 87;
  const w = Math.round(h * (template.ratio === "2:3" ? 2 / 3 : 3 / 2));
  const radius = 6;
  const clipId = `${template.id}-preview-clip`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="block overflow-hidden rounded-[6px]"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={w} height={h} rx={radius} ry={radius} />
        </clipPath>
      </defs>
      <rect
        x={0.75}
        y={0.75}
        width={w - 1.5}
        height={h - 1.5}
        rx={radius}
        ry={radius}
        fill="#ffffff"
        stroke="rgba(133, 154, 206, 0.28)"
        strokeWidth={1.5}
      />
      <g clipPath={`url(#${clipId})`}>
        {template.panels.map((p, i) => (
          <rect
            key={i}
            x={p.x * w}
            y={p.y * h}
            width={p.w * w}
            height={p.h * h}
            fill="none"
            stroke="#0b1430"
            strokeWidth={1.5}
          />
        ))}
      </g>
    </svg>
  );
}

function ElementShape({
  el,
  selectable,
  onPointerDown,
}: {
  el: Element;
  selectable: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const cursor = selectable ? "move" : undefined;
  const areaPe = selectable ? "all" : "none";
  const strokePe = selectable ? "stroke" : "none";
  const hitStroke = Math.max("strokeWidth" in el ? el.strokeWidth : 0, 16);

  switch (el.type) {
    case "eraser":
      return (
        <path
          d={pathD(el.points)}
          fill="none"
          stroke="#ffffff"
          strokeWidth={el.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      );
    case "path":
      return (
        <g onPointerDown={onPointerDown} style={{ cursor }}>
          <path
            d={pathD(el.points)}
            fill="none"
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          <path
            d={pathD(el.points)}
            fill="none"
            stroke="transparent"
            strokeWidth={hitStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents={strokePe}
          />
        </g>
      );
    case "line":
      return (
        <g onPointerDown={onPointerDown} style={{ cursor }}>
          <line
            x1={el.x1}
            y1={el.y1}
            x2={el.x2}
            y2={el.y2}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            pointerEvents="none"
          />
          <line
            x1={el.x1}
            y1={el.y1}
            x2={el.x2}
            y2={el.y2}
            stroke="transparent"
            strokeWidth={hitStroke}
            strokeLinecap="round"
            pointerEvents={strokePe}
          />
        </g>
      );
    case "rect":
      return (
        <rect
          x={el.x}
          y={el.y}
          width={Math.max(0, el.w)}
          height={Math.max(0, el.h)}
          fill="none"
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          pointerEvents={areaPe}
          onPointerDown={onPointerDown}
          style={{ cursor }}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={el.x + el.w / 2}
          cy={el.y + el.h / 2}
          rx={Math.abs(el.w / 2)}
          ry={Math.abs(el.h / 2)}
          fill="none"
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          pointerEvents={areaPe}
          onPointerDown={onPointerDown}
          style={{ cursor }}
        />
      );
    case "image":
      return (
        <image
          href={el.href}
          x={el.x}
          y={el.y}
          width={Math.max(0, el.w)}
          height={Math.max(0, el.h)}
          preserveAspectRatio="none"
          pointerEvents={areaPe}
          onPointerDown={onPointerDown}
          style={{ cursor }}
        />
      );
  }
}
