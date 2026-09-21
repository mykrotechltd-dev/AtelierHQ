import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import type { PatternBlock } from "@/lib/pattern-engine.ts";
import { buildBlockSvg } from "@/lib/pattern-svg.ts";
import { generatePatternsPDF } from "@/lib/pattern-pdf.ts";
import Chip from "@/components/chip.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";

/** The exact SVG each block exports, shown as source with copy and download. */
export function SvgSourceView({
  blocks,
  onDownload,
}: {
  blocks: PatternBlock[];
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
        <SvgSourceCard key={block.id} block={block} onDownload={onDownload} />
      ))}
    </div>
  );
}

function SvgSourceCard({
  block,
  onDownload,
}: {
  block: PatternBlock;
  onDownload: (id: PatternBlock["id"]) => void;
}) {
  const source = useMemo(() => buildBlockSvg(block), [block]);
  const bytes = new Blob([source]).size;
  const { w, h } = block.viewBox;

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
            Real size {w.toFixed(0)} × {h.toFixed(0)} cm
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
      <pre
        tabIndex={0}
        aria-label={`SVG source for ${block.name}`}
        className="max-h-80 overflow-auto bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground/80"
      >
        <code>{source.replace(/></g, ">\n<")}</code>
      </pre>
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
