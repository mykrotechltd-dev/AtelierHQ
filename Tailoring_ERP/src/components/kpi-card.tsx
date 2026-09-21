import { Card } from "@/components/ui/card.tsx";
import Chip, { type ChipTone } from "@/components/chip.tsx";
import { cn } from "@/lib/utils.ts";

/** Headline figure with a small status chip. `raised` lifts the one or two
 *  cards that carry the highest-priority number. */
export default function KpiCard({
  label,
  value,
  chip,
  tone = "neutral",
  raised,
  onClick,
}: {
  label: string;
  value: string;
  chip?: string;
  tone?: ChipTone;
  raised?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <Card
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "gap-2 px-5 py-5",
        raised && "shadow-lg shadow-foreground/5",
        interactive &&
          "cursor-pointer transition-colors hover:border-muted-foreground/40",
      )}
    >
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {chip && (
        <Chip tone={tone} className="mt-1">
          {chip}
        </Chip>
      )}
    </Card>
  );
}
