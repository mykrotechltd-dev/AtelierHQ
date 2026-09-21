import { cn } from "@/lib/utils.ts";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  good: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  crit: "bg-destructive-soft text-destructive",
} as const;

export type ChipTone = keyof typeof TONES;

/** Small status pill. Colour is never the only signal, so callers should
 *  always put a word (or icon plus word) inside it. */
export default function Chip({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold [&>svg]:size-3.5",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
