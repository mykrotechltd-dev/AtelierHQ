import { Calendar } from "atelierhq-ui";

export function SingleDate() {
  return (
    <div className="p-4 w-fit">
      <Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} selected={new Date(2026, 9, 14)} className="rounded-lg border" />
    </div>
  );
}

export function DateRange() {
  return (
    <div className="p-4 w-fit">
      <Calendar
        mode="range"
        defaultMonth={new Date(2026, 9, 1)}
        selected={{ from: new Date(2026, 9, 12), to: new Date(2026, 9, 18) }}
        className="rounded-lg border"
      />
    </div>
  );
}
