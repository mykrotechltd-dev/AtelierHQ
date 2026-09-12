import { Fragment, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminClients } from "@/lib/queries/admin.ts";
import { AdminErrorState } from "../_components/admin-error-state.tsx";
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
import { Users, Search, ChevronDown, ChevronRight } from "lucide-react";

const MEASUREMENT_LABELS: Record<string, string> = {
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  shoulder: "Shoulder",
  sleeveLength: "Sleeve length",
  inseam: "Inseam",
  neck: "Neck",
  thigh: "Thigh",
  height: "Height",
  weight: "Weight",
};

export default function AdminClientsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { results, status, loadMore, retry } = useAdminClients(
    debouncedSearch || undefined,
    20,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Clients"
        description="Client profiles and measurement logs across every shop."
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by client name…"
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
              <Users />
            </EmptyMedia>
            <EmptyTitle>No clients found</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "No shop has added a client yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Client</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((client) => {
                const isOpen = expandedId === client.id;
                const measurementEntries = client.measurements
                  ? Object.entries(client.measurements).filter(
                      ([key, value]) => key !== "notes" && value != null,
                    )
                  : [];
                return (
                  <Fragment key={client.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(isOpen ? null : client.id)
                      }
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.tenantName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.email ?? "—"}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          {measurementEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              No measurements saved for this client.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 py-2">
                              {measurementEntries.map(([key, value]) => (
                                <div key={key}>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {MEASUREMENT_LABELS[key] ?? key}
                                  </p>
                                  <p className="text-sm font-medium text-foreground">
                                    {String(value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
    </div>
  );
}
