import { cn } from "@/lib/utils.ts";

export default function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-6", className)}
    >
      <div>
        <h1 className="font-sans text-2xl font-semibold text-foreground leading-tight">
          {title}
        </h1>
        {description && (
          <p className="font-body text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}
