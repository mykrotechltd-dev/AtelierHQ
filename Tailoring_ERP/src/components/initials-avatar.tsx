import { cn } from "@/lib/utils.ts";

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function InitialsAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-foreground dark:bg-primary dark:text-primary-foreground",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-11 text-sm",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
