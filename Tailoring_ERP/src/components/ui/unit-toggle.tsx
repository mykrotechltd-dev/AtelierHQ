import { useMeasurementUnit } from "@/components/providers/measurement-unit.tsx";
import { cn } from "@/lib/utils.ts";

/** Small cm/in segmented switch, wired to the app-wide measurement unit preference. */
export function UnitToggle({ className }: { className?: string }) {
  const { unit, setUnit } = useMeasurementUnit();

  return (
    <div className={cn("inline-flex rounded-md bg-muted p-0.5 text-xs", className)}>
      {(["cm", "in"] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          className={cn(
            "cursor-pointer rounded px-2 py-1 font-medium transition-colors",
            unit === u ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
