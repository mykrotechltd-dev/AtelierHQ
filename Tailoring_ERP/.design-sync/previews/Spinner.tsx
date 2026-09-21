import { Spinner, Button } from "atelierhq-ui";

export function Sizes() {
  return (
    <div className="flex items-center gap-6 text-muted-foreground">
      <Spinner className="size-4" />
      <Spinner className="size-5" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <Spinner className="size-10 text-primary" />
    </div>
  );
}

export function InButton() {
  return (
    <div className="flex items-center gap-3">
      <Button disabled>
        <Spinner /> Saving order…
      </Button>
      <Button variant="outline" disabled>
        <Spinner /> Sending invoice…
      </Button>
    </div>
  );
}

export function CentredLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6 w-72 h-40">
      <Spinner className="size-8 text-primary" />
      <p className="text-sm text-muted-foreground">Loading ORD-0042…</p>
    </div>
  );
}
