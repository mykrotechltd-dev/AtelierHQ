import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Download } from "lucide-react";
import type { PatternBlock } from "@/lib/pattern-engine.ts";
import { buildBlockSvg } from "@/lib/pattern-svg.ts";
import { generatePatternsPDF } from "@/lib/pattern-pdf.ts";
import { inToUnit, unitLabel, type MeasurementUnit } from "@/lib/units.ts";
import Chip from "@/components/chip.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";

/** The exact SVG each block exports, shown as source with copy and download. */
export function SvgSourceView({
  blocks,
  unit,
  onDownload,
}: {
  blocks: PatternBlock[];
  unit: MeasurementUnit;
  onDownload: (id: PatternBlock["id"]) => void;
}) {
  if (blocks.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Enter the required measurements to see the SVG for each block.
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <SvgSourceCard
          key={block.id}
          block={block}
          unit={unit}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

function SvgSourceCard({
  block,
  unit,
  onDownload,
}: {
  block: PatternBlock;
  unit: MeasurementUnit;
  onDownload: (id: PatternBlock["id"]) => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const source = useMemo(() => buildBlockSvg(block), [block]);
  // What actually goes on screen: the XML prolog is meaningless inside an
  // HTML document, and the browser drops it silently either way — strip it
  // so the injected markup is just the <svg> root.
  const inlineMarkup = useMemo(
    () => source.replace(/^<\?xml[^>]*\?>\s*/, ""),
    [source],
  );
  const bytes = new Blob([source]).size;
  // block.viewBox is always stored in inches (lib/units.ts); convert to
  // whichever unit the tailor has selected for display, same as every
  // other measurement on this page.
  const { w: wIn, h: hIn } = block.viewBox;
  const w = inToUnit(wIn, unit);
  const h = inToUnit(hIn, unit);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      toast.success("SVG copied");
    } catch {
      toast.error("Copy is blocked here. Select the code and copy it.");
    }
  };

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-semibold">{block.name}</b>
          <Chip>{(bytes / 1024).toFixed(1)} KB</Chip>
          <Chip tone="accent">
            Real size {w.toFixed(0)} × {h.toFixed(0)} {unitLabel(unit)}
          </Chip>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy /> Copy SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(block.id)}
          >
            <Download /> Download
          </Button>
        </div>
      </div>

      {/* This is a render of the exact file above, not a redrawn stand-in —
          what downloading gets you is what's on screen here. The markup is
          our own generator's output (buildBlockSvg), never user input, so
          injecting it is safe. Its width/height are real millimetres (a
          trouser or dress panel can be well over a metre long), so the
          child selector below scales it down to fit the card instead of
          rendering at that physical size. */}
      <div
        className="flex items-center justify-center bg-[#f8f6f0] p-6 [&>svg]:h-auto [&>svg]:max-h-[420px] [&>svg]:w-auto [&>svg]:max-w-full dark:bg-[#1c1a14]"
        dangerouslySetInnerHTML={{ __html: inlineMarkup }}
      />

      <button
        type="button"
        aria-expanded={showSource}
        onClick={() => setShowSource((v) => !v)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 border-t px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        View SVG source
        <ChevronDown
          className={cn("size-4 transition-transform", showSource && "rotate-180")}
        />
      </button>
      {showSource && (
        <pre
          tabIndex={0}
          aria-label={`SVG source for ${block.name}`}
          className="max-h-80 overflow-auto border-t bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground/80"
        >
          <code>{source.replace(/></g, ">\n<")}</code>
        </pre>
      )}
    </Card>
  );
}

/** The real PDF the download button produces, rendered in the page. */
export function PdfPreview({
  blocks,
  customerName,
}: {
  blocks: PatternBlock[];
  customerName: string;
}) {
  const blob = useMemo(
    () =>
      blocks.length === 0
        ? null
        : generatePatternsPDF(blocks, customerName).output("blob"),
    [blocks, customerName],
  );
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!blob || !frame.current) return;
    const url = URL.createObjectURL(blob);
    frame.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!blob) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Enter the required measurements to preview the PDF.
      </Card>
    );
  }
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3.5">
        <b className="font-semibold">Pattern sheet</b>
        <Chip>A4</Chip>
        <Chip tone="accent">{blocks.length + 1} pages</Chip>
      </div>
      <iframe
        ref={frame}
        title="PDF preview of the pattern sheets"
        className="h-[70vh] min-h-[420px] w-full bg-muted"
      />
    </Card>
  );
}
