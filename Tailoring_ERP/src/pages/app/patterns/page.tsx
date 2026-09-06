import { useState, useMemo } from "react";
import { useCustomers, useCustomer } from "@/lib/queries/customers.ts";
import { toast } from "sonner";
import { format } from "date-fns";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  generateAllBlocks,
  BLOCK_LABELS,
  CATALOG,
  UK_SIZES,
  STANDARD_SIZES,
  EASE_LABELS,
  type Measurements,
  type BlockType,
  type CatalogEntry,
  type EasePreset,
  type UKSize,
  type PatternBlock,
} from "@/lib/pattern-engine.ts";
import { downloadPatternsPDF } from "@/lib/pattern-pdf.ts";
import PatternBlockSVG from "./_components/pattern-block-svg.tsx";
import CurveEditor from "./_components/curve-editor.tsx";
import {
  Scissors,
  Download,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  User,
  Ruler,
  SlidersHorizontal,
  CheckCircle2,
  Spline,
  RotateCcw,
} from "lucide-react";

// ── Measurement field definitions ─────────────────────────────────────────────

type MeasField = { key: keyof Measurements; label: string; hint: string };

const ALL_FIELDS: MeasField[] = [
  { key: "chest", label: "Chest / Bust", hint: "Full circumference at widest point" },
  { key: "waist", label: "Waist", hint: "Natural waistline circumference" },
  { key: "hips", label: "Hips", hint: "Full hip circumference at widest point" },
  { key: "shoulder", label: "Shoulder width", hint: "Nape to shoulder tip, both sides" },
  { key: "sleeveLength", label: "Sleeve length", hint: "Shoulder tip to wrist" },
  { key: "inseam", label: "Inseam", hint: "Crotch to ankle" },
  { key: "neck", label: "Neck", hint: "Neck circumference (optional)" },
  { key: "thigh", label: "Thigh", hint: "Upper thigh circumference (optional)" },
  { key: "height", label: "Height", hint: "Full body height" },
  // Lety Antony / Helen Joseph-Armstrong bodice method — all optional, and
  // estimated from the fields above when left blank (see bodice-calculator.ts).
  { key: "shoulderDrop", label: "Shoulder drop", hint: "Shoulder-top line down to the true shoulder tip (optional)" },
  { key: "bustDepth", label: "Bust depth", hint: "Neck point down to the bust apex (optional)" },
  { key: "centerFrontLength", label: "Centre front length", hint: "Neck pit to waist, straight down centre front (optional)" },
  { key: "acrossChestWidth", label: "Across chest", hint: "Full across-chest width at armhole depth (optional)" },
  { key: "centerBackLength", label: "Centre back length", hint: "Nape to waist, straight down centre back (optional)" },
  { key: "acrossBackWidth", label: "Across back", hint: "Full across-back width at armhole depth (optional)" },
  { key: "sideSeamLength", label: "Side seam length", hint: "Underarm to waist (optional, shared by front and back)" },
];

const FIELDS_BY_BLOCK: Record<string, (keyof Measurements)[]> = {
  skirt: ["waist", "hips", "height"],
  bodice: [
    "chest",
    "waist",
    "shoulder",
    "neck",
    "height",
    "shoulderDrop",
    "bustDepth",
    "centerFrontLength",
    "acrossChestWidth",
    "centerBackLength",
    "acrossBackWidth",
    "sideSeamLength",
  ],
  trouser: ["waist", "hips", "inseam", "thigh", "height"],
  sleeve: ["shoulder", "sleeveLength", "chest"],
  dress: ["chest", "waist", "hips", "shoulder", "neck", "height"],
};

// ── Thumbnail SVGs for catalog ────────────────────────────────────────────────

function SkirtThumbnail() {
  return (
    <svg viewBox="0 0 80 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 10 L65 10 L75 95 L5 95 Z" fill="#f5f0e8" stroke="#1c2850" strokeWidth="1.5" />
      <line x1="15" y1="10" x2="65" y2="10" stroke="#1c2850" strokeWidth="1.5" />
      <line x1="37" y1="10" x2="40" y2="28" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="43" y1="10" x2="40" y2="28" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="40" y1="55" x2="40" y2="85" stroke="#b48c3c" strokeWidth="1.2" />
      <polyline points="37,59 40,55 43,59" stroke="#b48c3c" strokeWidth="1" fill="none" />
      <polyline points="37,81 40,85 43,81" stroke="#b48c3c" strokeWidth="1" fill="none" />
    </svg>
  );
}

function BodiceThumbnail() {
  return (
    <svg viewBox="0 0 80 90" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 5 Q30 3 35 8 L55 12 Q70 25 68 38 Q65 52 55 55 L25 55 Q15 52 12 38 Q10 25 25 12 Z"
        fill="#f5f0e8"
        stroke="#1c2850"
        strokeWidth="1.5"
      />
      <path d="M20 5 Q15 8 14 14" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" fill="none" />
      <path d="M35 8 L55 12" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" fill="none" />
      <line x1="28" y1="55" x2="32" y2="46" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="36" y1="55" x2="32" y2="46" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="40" y1="18" x2="40" y2="48" stroke="#b48c3c" strokeWidth="1.2" />
      <polyline points="37,22 40,18 43,22" stroke="#b48c3c" strokeWidth="1" fill="none" />
      <polyline points="37,44 40,48 43,44" stroke="#b48c3c" strokeWidth="1" fill="none" />
    </svg>
  );
}

function TrouserThumbnail() {
  return (
    <svg viewBox="0 0 80 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 10 L70 10 L75 45 Q65 48 55 45 L45 115 L35 115 L25 45 Q15 48 5 45 Z"
        fill="#f5f0e8"
        stroke="#1c2850"
        strokeWidth="1.5"
      />
      <line x1="10" y1="10" x2="70" y2="10" stroke="#1c2850" strokeWidth="1.5" />
      <line x1="35" y1="10" x2="38" y2="24" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="45" y1="10" x2="42" y2="24" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" />
      <line x1="40" y1="25" x2="40" y2="85" stroke="#b48c3c" strokeWidth="1.2" />
      <polyline points="37,29 40,25 43,29" stroke="#b48c3c" strokeWidth="1" fill="none" />
      <polyline points="37,81 40,85 43,81" stroke="#b48c3c" strokeWidth="1" fill="none" />
    </svg>
  );
}

function SleeveThumbnail() {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 42 C14 22 26 8 40 6 C54 8 66 22 72 42 L62 102 L18 102 Z"
        fill="#f5f0e8"
        stroke="#1c2850"
        strokeWidth="1.5"
      />
      <line x1="8" y1="42" x2="72" y2="42" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" />
      <line x1="13" y1="72" x2="67" y2="72" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" />
      <line x1="22" y1="26" x2="22" y2="31" stroke="#1c2850" strokeWidth="1.2" />
      <line x1="57" y1="26" x2="57" y2="31" stroke="#1c2850" strokeWidth="1.2" />
      <line x1="60" y1="26" x2="60" y2="31" stroke="#1c2850" strokeWidth="1.2" />
      <line x1="40" y1="30" x2="40" y2="90" stroke="#b48c3c" strokeWidth="1.2" />
      <polyline points="37,34 40,30 43,34" stroke="#b48c3c" strokeWidth="1" fill="none" />
      <polyline points="37,86 40,90 43,86" stroke="#b48c3c" strokeWidth="1" fill="none" />
    </svg>
  );
}

function DressThumbnail() {
  return (
    <svg viewBox="0 0 80 130" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22 6 Q31 4 36 9 L54 13 Q68 24 66 36 Q64 46 58 50 L60 66 Q64 80 70 124 L10 124 Q16 80 20 66 L22 50 Q16 46 14 36 Q12 24 26 13 Z"
        fill="#f5f0e8"
        stroke="#1c2850"
        strokeWidth="1.5"
      />
      <path d="M22 6 Q17 9 16 15" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" fill="none" />
      <line x1="14" y1="50" x2="60" y2="50" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" />
      <line x1="17" y1="70" x2="64" y2="70" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="3 2" />
      <path d="M33 40 L30 50 L33 62 L36 50 Z" stroke="#1c2850" strokeWidth="1" strokeDasharray="4 2" fill="none" />
      <line x1="42" y1="24" x2="42" y2="108" stroke="#b48c3c" strokeWidth="1.2" />
      <polyline points="39,28 42,24 45,28" stroke="#b48c3c" strokeWidth="1" fill="none" />
      <polyline points="39,104 42,108 45,104" stroke="#b48c3c" strokeWidth="1" fill="none" />
    </svg>
  );
}

const THUMBNAILS = {
  skirt: SkirtThumbnail,
  bodice: BodiceThumbnail,
  trouser: TrouserThumbnail,
  sleeve: SleeveThumbnail,
  dress: DressThumbnail,
};

// ── Main page ─────────────────────────────────────────────────────────────────

type Step = "catalog" | "draft";

export default function PatternsPage() {
  const [step, setStep] = useState<Step>("catalog");
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);

  const handleSelectBlock = (entry: CatalogEntry) => {
    setSelectedEntry(entry);
    setStep("draft");
  };

  const handleBack = () => {
    setStep("catalog");
    setSelectedEntry(null);
  };

  if (step === "draft" && selectedEntry) {
    return <DraftWorkspace entry={selectedEntry} onBack={handleBack} />;
  }

  return <Catalog onSelect={handleSelectBlock} />;
}

// ── Catalog ───────────────────────────────────────────────────────────────────

function Catalog({ onSelect }: { onSelect: (e: CatalogEntry) => void }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Pattern Lab"
        description="Draft bespoke basic blocks and slopers from body measurements."
      />

      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 mb-8">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          <strong>Basic drafts only.</strong> These blocks are generated from standard
          quarter-measurement + ease formulas. Test in a toile and verify with a trained
          patternmaker before cutting final fabric. No seam allowance is included.
        </p>
      </div>

      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Choose a block to draft
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CATALOG.map((entry) => {
          const Thumb = THUMBNAILS[entry.thumbnail];
          return (
            <Card
              key={entry.id}
              className="cursor-pointer group hover:border-primary/60 hover:shadow-md transition-all overflow-hidden pt-0"
              onClick={() => onSelect(entry)}
            >
              {/* Thumbnail */}
              <div className="bg-[#f5f0e8] dark:bg-[#1a1814] h-48 flex items-center justify-center p-6 group-hover:bg-[#ede8df] dark:group-hover:bg-[#1e1c18] transition-colors">
                <div className="w-28 h-36 opacity-90 group-hover:opacity-100 transition-opacity">
                  <Thumb />
                </div>
              </div>

              <CardHeader className="pb-2 pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-display">{entry.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.subtitle}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
                </div>
              </CardHeader>

              <CardContent className="pb-5">
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {entry.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {entry.required.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">
                      {r}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Draft workspace ───────────────────────────────────────────────────────────

type MeasSource = "bespoke" | "customer" | "standard";

function DraftWorkspace({ entry, onBack }: { entry: CatalogEntry; onBack: () => void }) {
  const [measSource, setMeasSource] = useState<MeasSource>("bespoke");
  const [customerId, setCustomerId] = useState<string | "">("");
  const [ukSize, setUkSize] = useState<UKSize | "">("");
  const [measurements, setMeasurements] = useState<Partial<Record<keyof Measurements, string>>>({});
  const [ease, setEase] = useState<EasePreset>("standard");
  const [skirtLength, setSkirtLength] = useState("60");
  const [dressLength, setDressLength] = useState("70");
  // Bodice construction toggles (Lety Antony / Helen Joseph-Armstrong method).
  const [bodiceShoulderDart, setBodiceShoulderDart] = useState(true);
  const [bodiceSwayback, setBodiceSwayback] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Curve editing state
  // blockId → { pathIndex → overridden d string }
  const [curveOverrides, setCurveOverrides] = useState<Record<string, Record<number, string>>>({});
  const [editingBlockId, setEditingBlockId] = useState<BlockType | null>(null);

  // Customer list
  const { results: customers, status: custStatus } = useCustomers(undefined, 100);

  const selectedCustomer = useCustomer(customerId || undefined);

  // Resolve measurements based on source
  const resolvedMeasurements = useMemo((): Measurements => {
    if (measSource === "customer" && selectedCustomer?.measurements) {
      const m = selectedCustomer.measurements;
      const out: Measurements = {};
      (Object.keys(m) as (keyof typeof m)[]).forEach((k) => {
        if (k !== "notes" && m[k] !== undefined) {
          (out as Record<string, number>)[k] = m[k] as number;
        }
      });
      return out;
    }
    if (measSource === "standard" && ukSize) {
      return { ...STANDARD_SIZES[ukSize] };
    }
    // bespoke
    const out: Measurements = {};
    for (const f of ALL_FIELDS) {
      const v = parseFloat(measurements[f.key] ?? "");
      if (!isNaN(v) && v > 0) (out as Record<string, number>)[f.key] = v;
    }
    return out;
  }, [measSource, selectedCustomer, ukSize, measurements]);

  // Live preview — always computed, no Generate button
  const rawBlocks = useMemo(
    () =>
      generateAllBlocks(resolvedMeasurements, {
        skirtLength: parseFloat(skirtLength) || 60,
        dressLength: parseFloat(dressLength) || 70,
        ease,
        bodiceShoulderDart,
        bodiceSwayback,
      }).filter((b) => entry.blocks.includes(b.id)),
    [resolvedMeasurements, skirtLength, dressLength, ease, bodiceShoulderDart, bodiceSwayback, entry.blocks]
  );

  // Apply any user curve edits on top of engine-generated paths
  const blocks: PatternBlock[] = useMemo(
    () =>
      rawBlocks.map((block) => {
        const overrides = curveOverrides[block.id];
        if (!overrides || Object.keys(overrides).length === 0) return block;
        return {
          ...block,
          paths: block.paths.map((path, i) =>
            overrides[i] !== undefined ? { ...path, d: overrides[i] } : path
          ),
        };
      }),
    [rawBlocks, curveOverrides]
  );

  const readyBlocks = blocks.filter((b) => b.missingMeasurements.length === 0);

  const handleSaveCurveEdits = (blockId: BlockType, edits: { index: number; d: string }[]) => {
    const map: Record<number, string> = {};
    for (const e of edits) map[e.index] = e.d;
    setCurveOverrides((prev) => ({ ...prev, [blockId]: map }));
    setEditingBlockId(null);
    toast.success("Curve edits applied");
  };

  const handleResetCurves = (blockId: BlockType) => {
    setCurveOverrides((prev) => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    toast.success("Curves reset to generated shape");
  };

  const handlePrefillFromCustomer = () => {
    if (!selectedCustomer?.measurements) return;
    const m = selectedCustomer.measurements;
    const prefilled: Partial<Record<keyof Measurements, string>> = {};
    (Object.keys(m) as (keyof typeof m)[]).forEach((k) => {
      if (k !== "notes" && m[k] !== undefined) prefilled[k as keyof Measurements] = String(m[k]);
    });
    setMeasurements(prefilled);
    setMeasSource("bespoke");
    toast.success("Measurements copied from customer profile");
  };

  const handleDownloadPDF = async () => {
    if (readyBlocks.length === 0) return;
    setDownloading(true);
    try {
      const name = selectedCustomer?.name ?? (ukSize ? `UK ${ukSize}` : "Bespoke");
      downloadPatternsPDF(readyBlocks, name);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSVG = (blockId: BlockType) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || block.missingMeasurements.length > 0) return;

    const { x, y, w, h } = block.viewBox;
    // Build SVG string
    const PATH_STROKES: Record<string, string> = {
      outline: `stroke="#1c2850" stroke-width="2" fill="#f8f6f0"`,
      dart: `stroke="#1c2850" stroke-width="1" stroke-dasharray="6 3" fill="none"`,
      grainline: `stroke="#b48c3c" stroke-width="1.5" fill="none"`,
      construction: `stroke="#6b7280" stroke-width="0.75" stroke-dasharray="4 3" fill="none"`,
      fold: `stroke="#b48c3c" stroke-width="1.5" stroke-dasharray="8 3" fill="none"`,
    };
    const pathsStr = block.paths
      .map((p) => `<path d="${p.d}" ${PATH_STROKES[p.type]} stroke-linejoin="round" stroke-linecap="round"/>`)
      .join("\n");
    const labelsStr = block.labels
      .map(
        (l) =>
          `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor ?? "start"}" font-size="${l.fontSize ?? 5}" fill="#1c2850" font-family="sans-serif"${l.rotate ? ` transform="rotate(${-l.rotate}, ${l.x}, ${l.y})"` : ""}>${l.text}</text>`
      )
      .join("\n");
    const svgStr = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * 10}mm" height="${h * 10}mm">\n<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8f6f0"/>\n${pathsStr}\n${labelsStr}\n</svg>`;
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${block.id}-block.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${block.name} SVG downloaded`);
  };

  const relevantFields = ALL_FIELDS.filter((f) =>
    (FIELDS_BY_BLOCK[entry.id] ?? ALL_FIELDS.map((f) => f.key)).includes(f.key)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="cursor-pointer">
          <ArrowLeft className="size-4 mr-1" />
          Back to Lab
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-display font-semibold">{entry.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Step 1: Measurement source */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="size-3.5 text-muted-foreground" />
                Step 1 — Measurements source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Source tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {(
                  [
                    { id: "bespoke", label: "Bespoke" },
                    { id: "customer", label: "Customer" },
                    { id: "standard", label: "UK Size" },
                  ] as { id: MeasSource; label: string }[]
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setMeasSource(id)}
                    className={`cursor-pointer text-xs py-1.5 rounded-md transition-colors font-medium ${
                      measSource === id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Customer picker */}
              {measSource === "customer" && (
                <div className="space-y-2">
                  {custStatus === "LoadingFirstPage" ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <Select
                      value={customerId}
                      onValueChange={(v) => setCustomerId(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer…" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {customerId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={handlePrefillFromCustomer}
                      disabled={!selectedCustomer?.measurements}
                    >
                      {selectedCustomer?.measurements
                        ? "Copy to bespoke fields"
                        : "No saved measurements"}
                    </Button>
                  )}
                  {customerId && selectedCustomer && !selectedCustomer.measurements && (
                    <p className="text-[11px] text-amber-600">
                      This customer has no saved measurements. Go to their profile to add them.
                    </p>
                  )}
                </div>
              )}

              {/* UK size picker */}
              {measSource === "standard" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-1">
                    {UK_SIZES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setUkSize(s)}
                        className={`cursor-pointer text-xs py-1.5 rounded border transition-colors font-medium ${
                          ukSize === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {ukSize && (
                    <p className="text-[11px] text-muted-foreground">
                      Standard measurements for UK {ukSize}. These may not fit accurately — for best
                      results, enter bespoke measurements.
                    </p>
                  )}
                </div>
              )}

              {/* Bespoke measurement fields */}
              {measSource === "bespoke" && (
                <div className="space-y-3 mt-1">
                  {relevantFields.map((field) => {
                    const isRequired = entry.required.includes(field.key);
                    return (
                      <div key={field.key}>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs font-medium">
                            {field.label}{" "}
                            <span className="text-muted-foreground font-normal">(cm)</span>
                          </Label>
                          {isRequired && (
                            <span className="text-[10px] text-destructive font-medium">required</span>
                          )}
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0"
                          className="text-sm"
                          value={measurements[field.key] ?? ""}
                          onChange={(e) =>
                            setMeasurements((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                        />
                        <p className="text-[11px] text-muted-foreground mt-0.5">{field.hint}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                Step 2 — Customise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ease */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Ease / Fit</Label>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {(Object.keys(EASE_LABELS) as EasePreset[]).map((e) => (
                    <button
                      key={e}
                      onClick={() => setEase(e)}
                      className={`cursor-pointer text-xs py-1.5 rounded-md transition-colors font-medium ${
                        ease === e
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {EASE_LABELS[e]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {ease === "fitted" && "Reduced ease — close to the body"}
                  {ease === "standard" && "Standard ease — comfortable everyday fit"}
                  {ease === "relaxed" && "Extra ease — loose, oversized silhouette"}
                </p>
              </div>

              {/* Skirt length (skirt only) */}
              {entry.id === "skirt" && (
                <div>
                  <Label className="text-xs font-medium mb-1 block">
                    Skirt length <span className="text-muted-foreground font-normal">(cm)</span>
                  </Label>
                  <Input
                    type="number"
                    min="30"
                    max="120"
                    step="1"
                    className="text-sm"
                    value={skirtLength}
                    onChange={(e) => setSkirtLength(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Waist to hem. Default 60 cm (midi).
                  </p>
                </div>
              )}

              {/* Dress skirt length (dress only) */}
              {entry.id === "dress" && (
                <div>
                  <Label className="text-xs font-medium mb-1 block">
                    Skirt length below waist{" "}
                    <span className="text-muted-foreground font-normal">(cm)</span>
                  </Label>
                  <Input
                    type="number"
                    min="30"
                    max="130"
                    step="1"
                    className="text-sm"
                    value={dressLength}
                    onChange={(e) => setDressLength(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Waist to hem. Default 70 cm (below the knee).
                  </p>
                </div>
              )}

              {/* Bodice construction toggles (bodice/dress only) */}
              {(entry.id === "bodice" || entry.id === "dress") && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium block">Back bodice construction</Label>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={bodiceShoulderDart}
                      onChange={(e) => setBodiceShoulderDart(e.target.checked)}
                      className="mt-0.5"
                    />
                    Shoulder dart (shoulder-blade shaping)
                  </label>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={bodiceSwayback}
                      onChange={(e) => setBodiceSwayback(e.target.checked)}
                      className="mt-0.5"
                    />
                    Swayback contour (curved centre-back waist)
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="size-3.5 text-muted-foreground" />
                Step 3 — Download
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                onClick={handleDownloadPDF}
                disabled={readyBlocks.length === 0 || downloading}
              >
                <Download className="size-3.5 mr-1.5" />
                {downloading ? "Generating…" : "Download PDF"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {entry.blocks.map((bt) => {
                  const block = blocks.find((b) => b.id === bt);
                  const ready = (block?.missingMeasurements.length ?? 1) === 0;
                  return (
                    <Button
                      key={bt}
                      size="sm"
                      variant="secondary"
                      disabled={!ready}
                      onClick={() => handleDownloadSVG(bt)}
                      className="cursor-pointer"
                    >
                      SVG — {BLOCK_LABELS[bt].replace(" Front", "").replace(" Back", " Back")}
                    </Button>
                  );
                })}
              </div>
              {readyBlocks.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  Enter required measurements to enable download
                </p>
              )}
              {selectedCustomer && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  For: <strong>{selectedCustomer.name}</strong> · {format(new Date(), "dd MMM yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right panel: live preview ──────────────────────────────────── */}
        <div className="space-y-4">
          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {readyBlocks.length === blocks.length && blocks.length > 0 ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">
                    All {blocks.length} blocks ready
                  </span>
                </>
              ) : (
                <>
                  <Ruler className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {readyBlocks.length} of {blocks.length} blocks ready
                  </span>
                </>
              )}
            </div>
            <Badge variant="outline" className="text-xs capitalize">
              {ease} fit
            </Badge>
          </div>

          {/* Block preview tabs */}
          <Tabs defaultValue={entry.blocks[0]}>
            <TabsList className="flex-wrap h-auto gap-1">
              {entry.blocks.map((bt) => {
                const block = blocks.find((b) => b.id === bt);
                const missing = (block?.missingMeasurements.length ?? 0) > 0;
                return (
                  <TabsTrigger key={bt} value={bt} className="text-xs relative cursor-pointer">
                    {BLOCK_LABELS[bt]}
                    {missing && <span className="ml-1 text-destructive text-xs">!</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {blocks.map((block) => (
              <TabsContent key={block.id} value={block.id} className="mt-3">
                <Card>
                  <CardContent className="pt-5">
                    {block.missingMeasurements.length > 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <AlertTriangle className="size-6 text-amber-500" />
                        <div className="text-center">
                          <p className="text-sm font-medium">Missing measurements</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {block.missingMeasurements.join(", ")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Edit curves toolbar */}
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs text-muted-foreground">
                            {curveOverrides[block.id]
                              ? "Curves have been manually edited"
                              : "Engine-generated curves"}
                          </p>
                          <div className="flex items-center gap-2">
                            {curveOverrides[block.id] && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground cursor-pointer"
                                onClick={() => handleResetCurves(block.id)}
                              >
                                <RotateCcw className="size-3 mr-1" />
                                Reset curves
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-3 text-xs cursor-pointer"
                              onClick={() => setEditingBlockId(block.id)}
                            >
                              <Spline className="size-3 mr-1.5" />
                              Edit curves
                            </Button>
                          </div>
                        </div>

                        {/* Side-by-side preview */}
                        <div className="flex flex-wrap gap-6 justify-center">
                          {entry.blocks.length > 1 ? (
                            entry.blocks.map((bt) => {
                              const b = blocks.find((x) => x.id === bt)!;
                              return b.missingMeasurements.length === 0 ? (
                                <BlockPreview key={bt} block={b} />
                              ) : null;
                            })
                          ) : (
                            <BlockPreview block={block} large />
                          )}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 mt-5 px-1">
                          {[
                            { color: "#1c2850", dash: false, label: "Seam line" },
                            { color: "#1c2850", dash: true, label: "Dart" },
                            { color: "#b48c3c", dash: false, label: "Grain line" },
                            { color: "#6b7280", dash: true, label: "Construction" },
                          ].map(({ color, dash, label }) => (
                            <div key={label} className="flex items-center gap-1.5">
                              <svg width="20" height="8" viewBox="0 0 20 8">
                                <line
                                  x1="0" y1="4" x2="20" y2="4"
                                  stroke={color} strokeWidth="1.5"
                                  strokeDasharray={dash ? "4 2" : "0"}
                                />
                              </svg>
                              <span className="text-[11px] text-muted-foreground">{label}</span>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        {block.notes.length > 0 && (
                          <Accordion type="single" collapsible className="mt-4">
                            <AccordionItem value="notes">
                              <AccordionTrigger className="text-xs text-muted-foreground">
                                Block notes ({block.notes.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <ul className="space-y-1">
                                  {block.notes.map((note, i) => (
                                    <li
                                      key={i}
                                      className="text-xs text-muted-foreground flex items-start gap-2"
                                    >
                                      <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Quick measurement summary */}
          {readyBlocks.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Measurements used
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
                  {ALL_FIELDS.filter((f) => resolvedMeasurements[f.key] !== undefined).map((f) => (
                    <div key={f.key}>
                      <p className="text-[10px] text-muted-foreground uppercase">{f.label}</p>
                      <p className="text-sm font-medium">{resolvedMeasurements[f.key]} cm</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Curve Editor Dialog */}
      {editingBlockId && (() => {
        const block = blocks.find((b) => b.id === editingBlockId);
        if (!block || block.missingMeasurements.length > 0) return null;
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setEditingBlockId(null); }}>
            <DialogContent className="max-w-5xl w-full p-0 gap-0 overflow-hidden" style={{ height: "85vh" }}>
              <DialogHeader className="sr-only">
                <DialogTitle>Edit curves — {block.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col h-full overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b">
                  <Spline className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Edit curves — {block.name}</p>
                    <p className="text-xs text-muted-foreground">Drag handles to reshape seam lines</p>
                  </div>
                </div>
                {/* Editor fills remaining height */}
                <div className="flex-1 overflow-hidden">
                  <CurveEditor
                    block={block}
                    onSave={(edits) => handleSaveCurveEdits(editingBlockId, edits)}
                    onCancel={() => setEditingBlockId(null)}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

// ── Block preview card ────────────────────────────────────────────────────────

function BlockPreview({
  block,
  large = false,
}: {
  block: import("@/lib/pattern-engine.ts").PatternBlock;
  large?: boolean;
}) {
  const aspect = block.viewBox.h / block.viewBox.w;
  const width = large ? 300 : 210;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium">{block.name}</p>
      <div
        className="rounded border border-border bg-[#f8f6f0] dark:bg-[#1c1a14] overflow-hidden"
        style={{ width, height: Math.round(width * aspect) }}
      >
        <PatternBlockSVG block={block} className="w-full h-full" />
      </div>
    </div>
  );
}
