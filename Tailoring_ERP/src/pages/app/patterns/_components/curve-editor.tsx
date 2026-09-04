/**
 * CurveEditor
 *
 * An interactive SVG editor that lets users drag Bézier anchor points and
 * control-point handles on a single PatternPath. Only `outline` paths (seam
 * lines) expose curve editing; other path types are shown as read-only overlays.
 *
 * Coordinate system: centimetres (matching the pattern engine viewBox).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { PatternBlock, PatternPath } from "@/lib/pattern-engine.ts";
import {
  parsePath,
  serialisePath,
  extractPoints,
  applyPointMove,
  prevAnchor,
  type EditablePath,
  type EditPoint,
} from "@/lib/path-editor.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const ANCHOR_R = 0.6; // cm radius for anchor circles
const CP_R = 0.45;    // cm radius for control-point circles
const HIT_MARGIN = 1.2; // cm extra hit area around small handles

// ── Editable state per path ───────────────────────────────────────────────────

type EditState = {
  // pathIndex → overridden d string (only for edited paths)
  overrides: Record<number, string>;
};

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  block: PatternBlock;
  onSave: (editedPaths: { index: number; d: string }[]) => void;
  onCancel: () => void;
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CurveEditor({ block, onSave, onCancel }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { x: vbX, y: vbY, w: vbW, h: vbH } = block.viewBox;

  // Which path is being edited (only outline paths are editable)
  const editableIndices = block.paths
    .map((p, i) => (p.type === "outline" ? i : -1))
    .filter((i) => i >= 0);

  const [selectedPathIdx, setSelectedPathIdx] = useState<number>(editableIndices[0] ?? -1);
  const [state, setState] = useState<EditState>({ overrides: {} });
  const [dragging, setDragging] = useState<EditPoint | null>(null);
  const [cmds, setCmds] = useState<EditablePath>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  // Load the current path's commands into state when path changes
  useEffect(() => {
    if (selectedPathIdx < 0) return;
    const d = state.overrides[selectedPathIdx] ?? block.paths[selectedPathIdx].d;
    setCmds(parsePath(d));
  }, [selectedPathIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Points derived from current cmds
  const points = extractPoints(cmds);

  // ── SVG ↔ viewBox coordinate conversion ───────────────────────────────────

  function svgPtToCm(svgX: number, svgY: number): { x: number; y: number } | null {
    const el = svgRef.current;
    if (!el) return null;
    const pt = el.createSVGPoint();
    pt.x = svgX;
    pt.y = svgY;
    const inv = el.getScreenCTM()?.inverse();
    if (!inv) return null;
    const tp = pt.matrixTransform(inv);
    return { x: tp.x, y: tp.y };
  }

  // ── Drag handling ──────────────────────────────────────────────────────────

  const startDrag = useCallback((e: React.PointerEvent, pt: EditPoint) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(pt);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return;
      const cm = svgPtToCm(e.clientX, e.clientY);
      if (!cm) return;
      setCmds((prev) => applyPointMove(prev, dragging.cmdIdx, dragging.role, cm.x, cm.y));
    },
    [dragging]
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(null);
    // Persist to override map
    setCmds((prev) => {
      const d = serialisePath(prev);
      setState((s) => ({
        overrides: { ...s.overrides, [selectedPathIdx]: d },
      }));
      return prev;
    });
  }, [dragging, selectedPathIdx]);

  // ── Save / Reset ───────────────────────────────────────────────────────────

  const handleSave = () => {
    // Flush current cmds into overrides first
    const currentD = serialisePath(cmds);
    const allOverrides = { ...state.overrides, [selectedPathIdx]: currentD };
    const edits = Object.entries(allOverrides).map(([idx, d]) => ({
      index: Number(idx),
      d,
    }));
    onSave(edits);
  };

  const handleResetPath = () => {
    const d = block.paths[selectedPathIdx].d;
    setCmds(parsePath(d));
    setState((s) => {
      const next = { ...s.overrides };
      delete next[selectedPathIdx];
      return { overrides: next };
    });
  };

  const hasOverrides = Object.keys(state.overrides).length > 0 ||
    serialisePath(cmds) !== (state.overrides[selectedPathIdx] ?? block.paths[selectedPathIdx].d);

  // ── Render: background (read-only) paths ──────────────────────────────────

  function renderBgPaths() {
    return block.paths.map((path, i) => {
      if (i === selectedPathIdx) return null;
      const d = state.overrides[i] ?? path.d;
      const isEditable = editableIndices.includes(i);

      const styleProps: React.SVGProps<SVGPathElement> = {
        fill: path.type === "outline" ? "#f8f6f0" : "none",
        stroke:
          path.type === "outline"
            ? "#1c2850"
            : path.type === "grainline" || path.type === "fold"
            ? "#b48c3c"
            : path.type === "dart"
            ? "#1c2850"
            : "#9ca3af",
        strokeWidth: path.type === "outline" ? 1.2 : path.type === "grainline" ? 0.8 : 0.5,
        strokeDasharray:
          path.type === "dart"
            ? "1.5 0.8"
            : path.type === "construction"
            ? "0.8 0.6"
            : path.type === "fold"
            ? "2 0.8"
            : undefined,
        opacity: 0.55,
      };

      return (
        <path
          key={i}
          d={d}
          {...styleProps}
          className={isEditable ? "cursor-pointer" : ""}
          onClick={() => isEditable && setSelectedPathIdx(i)}
        />
      );
    });
  }

  // ── Render: active path ────────────────────────────────────────────────────

  function renderActivePath() {
    if (selectedPathIdx < 0 || cmds.length === 0) return null;
    return (
      <path
        d={serialisePath(cmds)}
        fill="#f8f6f0"
        stroke="#1c2850"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    );
  }

  // ── Render: tangent lines from anchors to control points ──────────────────

  function renderTangentLines() {
    return cmds.flatMap((cmd, i) => {
      const lines: React.ReactNode[] = [];
      const prev = prevAnchor(cmds, i);

      if (cmd.type === "Q") {
        if (prev) {
          lines.push(
            <line
              key={`${i}-t0`}
              x1={prev.x} y1={prev.y}
              x2={cmd.cpx} y2={cmd.cpy}
              stroke="#b48c3c" strokeWidth={0.25} strokeDasharray="0.4 0.3" opacity={0.7}
            />
          );
        }
        lines.push(
          <line
            key={`${i}-t1`}
            x1={cmd.cpx} y1={cmd.cpy}
            x2={cmd.x} y2={cmd.y}
            stroke="#b48c3c" strokeWidth={0.25} strokeDasharray="0.4 0.3" opacity={0.7}
          />
        );
      } else if (cmd.type === "C") {
        if (prev) {
          lines.push(
            <line
              key={`${i}-t0`}
              x1={prev.x} y1={prev.y}
              x2={cmd.cp1x} y2={cmd.cp1y}
              stroke="#b48c3c" strokeWidth={0.25} strokeDasharray="0.4 0.3" opacity={0.7}
            />
          );
        }
        lines.push(
          <line
            key={`${i}-t1`}
            x1={cmd.cp2x} y1={cmd.cp2y}
            x2={cmd.x} y2={cmd.y}
            stroke="#b48c3c" strokeWidth={0.25} strokeDasharray="0.4 0.3" opacity={0.7}
          />
        );
      }
      return lines;
    });
  }

  // ── Render: drag handles ──────────────────────────────────────────────────

  function renderHandles() {
    return points.map((pt) => {
      const isAnchor = pt.role === "anchor";
      const isDragging = dragging?.id === pt.id;
      const isHov = hovered === pt.id;
      const r = (isAnchor ? ANCHOR_R : CP_R) * (isDragging || isHov ? 1.4 : 1);

      return (
        <g key={pt.id}>
          {/* Hit area (invisible, larger) */}
          <circle
            cx={pt.x} cy={pt.y}
            r={r + HIT_MARGIN}
            fill="transparent"
            className="cursor-grab active:cursor-grabbing"
            onPointerEnter={() => setHovered(pt.id)}
            onPointerLeave={() => setHovered(null)}
            onPointerDown={(e) => startDrag(e, pt)}
          />
          {/* Visual handle */}
          <circle
            cx={pt.x} cy={pt.y}
            r={r}
            fill={isAnchor ? "#ffffff" : "#b48c3c"}
            stroke={isAnchor ? "#1c2850" : "#8a6628"}
            strokeWidth={0.3}
            style={{ pointerEvents: "none" }}
            opacity={isDragging ? 1 : 0.9}
          />
          {/* Inner dot for anchors */}
          {isAnchor && (
            <circle
              cx={pt.x} cy={pt.y} r={r * 0.35}
              fill="#1c2850"
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      );
    });
  }

  // ── Render: labels ────────────────────────────────────────────────────────

  function renderLabels() {
    return block.labels.map((label, i) => (
      <text
        key={i}
        x={label.x} y={label.y}
        textAnchor={label.anchor ?? "start"}
        fontSize={label.fontSize ?? 5}
        fill="#1c2850"
        fontFamily="sans-serif"
        opacity={0.6}
        transform={label.rotate ? `rotate(${-label.rotate}, ${label.x}, ${label.y})` : undefined}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label.text}
      </text>
    ));
  }

  const hasEditable = editableIndices.length > 0;

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">Editing seam lines:</span>
          {editableIndices.map((i) => (
            <button
              key={i}
              onClick={() => setSelectedPathIdx(i)}
              className={`text-xs px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                selectedPathIdx === i
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              Path {i + 1}
              {state.overrides[i] !== undefined && (
                <span className="ml-1 text-amber-500">●</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {hasOverrides && (
            <button
              onClick={handleResetPath}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
            >
              Reset path
            </button>
          )}
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded border border-border bg-background hover:bg-muted cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1 rounded bg-foreground text-background hover:opacity-90 cursor-pointer transition-opacity font-medium"
          >
            Apply changes
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
        <p className="text-[11px] text-amber-800 dark:text-amber-300">
          <strong>Drag</strong> white anchor points to reshape seam lines ·{" "}
          <strong>Gold diamonds</strong> are Bézier control handles — drag to adjust curve tension ·
          Click a different path button above to switch
        </p>
      </div>

      {/* SVG canvas */}
      {!hasEditable ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          This block has no editable seam lines.
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="w-full flex-1 min-h-[400px] bg-[#f8f6f0] dark:bg-[#1c1a14] touch-none select-none"
          style={{ cursor: dragging ? "grabbing" : "default" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Background paths */}
          {renderBgPaths()}

          {/* Active path */}
          {renderActivePath()}

          {/* Tangent lines */}
          {renderTangentLines()}

          {/* Labels */}
          {renderLabels()}

          {/* Handles */}
          {renderHandles()}
        </svg>
      )}
    </div>
  );
}
