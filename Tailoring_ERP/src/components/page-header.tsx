import { cn } from "@/lib/utils.ts";

export default function PageHeader({
  title,
  description,
  eyebrow,
  children,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 font-body text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
