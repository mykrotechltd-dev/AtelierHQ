import { useState } from "react";
import { useCustomers } from "@/lib/queries/customers.ts";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Users, Search, Phone, Mail, Ruler } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import CustomerDialog from "./_components/customer-dialog.tsx";
import { cn } from "@/lib/utils.ts";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { results, status, loadMore } = useCustomers(debouncedSearch || undefined, 20);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Customers" description="Manage your client records and measurements.">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Add customer
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{debouncedSearch ? "No customers found" : "No customers yet"}</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "Add your first customer to get started"}
            </EmptyDescription>
          </EmptyHeader>
          {!debouncedSearch && (
            <EmptyContent>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Add customer
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-2">
          {results.map((customer) => (
            <button
              key={customer.id}
              onClick={() => navigate(`/customers/${customer.id}`)}
              className={cn(
                "w-full text-left rounded-lg border border-border bg-card px-4 py-3",
                "hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-base font-medium text-foreground truncate">
                    {customer.name}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {customer.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                        <Phone className="size-3" /> {customer.phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                        <Mail className="size-3" /> {customer.email}
                      </span>
                    )}
                  </div>
                </div>
                {customer.measurements && (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-accent font-body bg-accent/10 rounded px-2 py-0.5">
                    <Ruler className="size-3" /> Measured
                  </span>
                )}
              </div>
            </button>
          ))}

          {status === "CanLoadMore" && (
            <div className="pt-4 text-center">
              <Button variant="secondary" size="sm" onClick={() => loadMore()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      <CustomerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
