import { useState } from "react";
import { useCustomers } from "@/lib/queries/customers.ts";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/page-header.tsx";
import Chip from "@/components/chip.tsx";
import InitialsAvatar from "@/components/initials-avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Ruler,
  Search,
  Users,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import CustomerDialog from "./_components/customer-dialog.tsx";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { results, status, loadMore } = useCustomers(
    debouncedSearch || undefined,
    20,
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        eyebrow="Client book"
        title="Customers"
        description="Your clients, their contact details and measurements."
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus /> Add customer
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 md:px-5">
          <label className="flex min-h-11 max-w-sm items-center gap-2.5 rounded-xl border bg-background px-3.5 text-muted-foreground focus-within:border-primary">
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Search customers</span>
            <input
              type="search"
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        {status === "LoadingFirstPage" ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-none" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>
                {debouncedSearch ? "No customers found" : "No customers yet"}
              </EmptyTitle>
              <EmptyDescription>
                {debouncedSearch
                  ? `Nothing matches "${debouncedSearch}". Check the spelling or try a phone number.`
                  : "Add your first customer to start taking measurements and orders."}
              </EmptyDescription>
            </EmptyHeader>
            {!debouncedSearch && (
              <EmptyContent>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus /> Add customer
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <ul className="divide-y">
            {results.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="flex min-h-[72px] w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 md:px-5"
                >
                  <InitialsAvatar name={customer.name} size="lg" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold">
                      {customer.name}
                    </b>
                    <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-muted-foreground">
                      {customer.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3.5" /> {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3.5" /> {customer.email}
                        </span>
                      )}
                    </span>
                  </span>
                  {customer.measurements ? (
                    <Chip tone="good">
                      <Ruler /> Measured
                    </Chip>
                  ) : (
                    <Chip>No measurements</Chip>
                  )}
                  <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status === "CanLoadMore" && (
        <div className="pt-5 text-center">
          <Button variant="outline" onClick={() => loadMore()}>
            Load more
          </Button>
        </div>
      )}

      <CustomerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
