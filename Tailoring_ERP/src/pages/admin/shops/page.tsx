import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminTenants } from "@/lib/queries/admin.ts";
import { useActivePlans } from "@/lib/queries/billing.ts";
import { tenantAccessTone } from "../_lib/admin-tone.ts";
import { AdminStatusBadge } from "../_components/admin-status-badge.tsx";
import { AdminErrorState } from "../_components/admin-error-state.tsx";
import OverrideSubscriptionDialog from "./_components/override-subscription-dialog.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Store, Search } from "lucide-react";
import type { AdminTenantRow } from "@/lib/supabase/admin-types.ts";

export default function AdminShopsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const { results, status, loadMore, retry } = useAdminTenants(
    debouncedSearch || undefined,
    20,
  );
  const plans = useActivePlans();
  const [editing, setEditing] = useState<AdminTenantRow | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Shops"
        description="Every shop on AtelierHQ and its subscription status."
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by shop name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : status === "Error" ? (
        <AdminErrorState onRetry={retry} />
      ) : results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store />
            </EmptyMedia>
            <EmptyTitle>No shops found</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "No shop has signed up yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Trial ends</TableHead>
                <TableHead>Paid through</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((t) => {
                const { tone, label } = tenantAccessTone(t.accessState);
                const planName =
                  plans?.find((p) => p.code === t.planCode)?.name ??
                  t.planCode ??
                  "—";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <AdminStatusBadge tone={tone} label={label} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {planName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(t.trialEndsAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.currentPeriodEnd
                        ? format(parseISO(t.currentPeriodEnd), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(t.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditing(t)}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="pt-4 text-center">
          <Button variant="secondary" size="sm" onClick={() => loadMore()}>
            Load more
          </Button>
        </div>
      )}

      <OverrideSubscriptionDialog
        tenant={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
