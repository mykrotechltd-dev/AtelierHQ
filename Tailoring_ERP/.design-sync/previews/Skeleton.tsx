import { Skeleton, Card } from "atelierhq-ui";

export function OrderRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="w-40" style={{ height: 12 }} />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CustomerCardSkeleton() {
  return (
    <Card className="w-full max-w-sm p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="w-48" style={{ height: 12 }} />
        </div>
      </div>
    </Card>
  );
}

export function MeasurementBlockSkeleton() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}
