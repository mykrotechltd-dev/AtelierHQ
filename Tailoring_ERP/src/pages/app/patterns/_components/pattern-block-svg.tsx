import type { PatternBlock, PatternPath, PatternLabel } from "@/lib/pattern-engine.ts";

// Colour scheme for SVG rendering (matches PDF palette)
const PATH_STYLES: Record<
  PatternPath["type"],
  { stroke: string; strokeWidth: number; strokeDasharray?: string; fill?: string }
> = {
  outline: { stroke: "#1c2850", strokeWidth: 2, fill: "#f8f6f0" },
  dart: { stroke: "#1c2850", strokeWidth: 1, strokeDasharray: "6 3" },
  grainline: { stroke: "#b48c3c", strokeWidth: 1.5 },
  construction: { stroke: "#6b7280", strokeWidth: 0.75, strokeDasharray: "4 3" },
  fold: { stroke: "#b48c3c", strokeWidth: 1.5, strokeDasharray: "8 3" },
};

function GrainlineArrows({ d }: { d: string }) {
  // Extract M and L/Q endpoint for arrowhead placement
  const parts = d.trim().split(/(?=[MLQZmlqz])/);
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  for (const p of parts) {
    const letter = p[0]?.toUpperCase();
    const nums = p.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (letter === "M") { x0 = nums[0]; y0 = nums[1]; }
    if (letter === "L") { x1 = nums[0]; y1 = nums[1]; }
  }
  const aw = 1.5;
  return (
    <>
      {/* Top arrowhead */}
      <polyline
        points={`${x0 - aw},${y0 + aw * 2} ${x0},${y0} ${x0 + aw},${y0 + aw * 2}`}
        stroke="#b48c3c" strokeWidth={1.2} fill="none"
      />
      {/* Bottom arrowhead */}
      <polyline
        points={`${x1 - aw},${y1 - aw * 2} ${x1},${y1} ${x1 + aw},${y1 - aw * 2}`}
        stroke="#b48c3c" strokeWidth={1.2} fill="none"
      />
    </>
  );
}

function PatternPathEl({ path }: { path: PatternPath }) {
  const style = PATH_STYLES[path.type];
  return (
    <>
      {path.type === "outline" ? (
        <path
          d={path.d}
          fill={style.fill ?? "none"}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={path.d}
          fill="none"
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.strokeDasharray}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {path.type === "grainline" && <GrainlineArrows d={path.d} />}
    </>
  );
}

function PatternLabelEl({ label }: { label: PatternLabel }) {
  if (label.rotate) {
    return (
      <text
        x={label.x}
        y={label.y}
        textAnchor={label.anchor ?? "start"}
        fontSize={label.fontSize ?? 5}
        fill="#1c2850"
        fontFamily="sans-serif"
        transform={`rotate(${-label.rotate}, ${label.x}, ${label.y})`}
      >
        {label.text}
      </text>
    );
  }
  return (
    <text
      x={label.x}
      y={label.y}
      textAnchor={label.anchor ?? "start"}
      fontSize={label.fontSize ?? 5}
      fill="#1c2850"
      fontFamily="sans-serif"
    >
      {label.text}
    </text>
  );
}

export default function PatternBlockSVG({
  block,
  className,
}: {
  block: PatternBlock;
  className?: string;
}) {
  const { x, y, w, h } = block.viewBox;

  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className={className}
      style={{ background: "transparent" }}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={block.name}
    >
      {/* Block paths */}
      {block.paths.map((path, i) => (
        <PatternPathEl key={i} path={path} />
      ))}

      {/* Labels */}
      {block.labels.map((label, i) => (
        <PatternLabelEl key={i} label={label} />
      ))}

      {/* Missing measurements overlay */}
      {block.missingMeasurements.length > 0 && (
        <>
          <rect x={x} y={y} width={w} height={h} fill="white" fillOpacity={0.75} />
          <text
            x={x + w / 2}
            y={y + h / 2 - 3}
            textAnchor="middle"
            fontSize={5}
            fill="#b48c3c"
            fontFamily="sans-serif"
          >
            Missing:
          </text>
          <text
            x={x + w / 2}
            y={y + h / 2 + 5}
            textAnchor="middle"
            fontSize={4}
            fill="#6b7280"
            fontFamily="sans-serif"
          >
            {block.missingMeasurements.join(", ")}
          </text>
        </>
      )}
    </svg>
  );
}
