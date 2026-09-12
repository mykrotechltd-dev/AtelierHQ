import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ClipboardList, User } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminQuickSearch } from "@/lib/queries/admin.ts";
import { Input } from "@/components/ui/input.tsx";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover.tsx";

export default function AdminHeader() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debouncedTerm] = useDebounce(term, 250);
  const [open, setOpen] = useState(false);
  const results = useAdminQuickSearch(debouncedTerm);

  const go = (kind: "order" | "client") => {
    setOpen(false);
    setTerm("");
    navigate(kind === "order" ? "/admin/orders" : "/admin/clients");
  };

  return (
    <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 md:px-6">
      <Popover open={open && debouncedTerm.trim().length > 0}>
        <PopoverAnchor asChild>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search clients or order numbers…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="pl-9"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] max-w-sm p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No matches for "{debouncedTerm}"
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(r.kind)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    {r.kind === "order" ? (
                      <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <User className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {r.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.subtitle ? `${r.subtitle} · ` : ""}
                        {r.tenantName}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </header>
  );
}
