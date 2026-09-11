import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminInventory } from "@/lib/queries/admin.ts";
import { inventoryTone } from "../_lib/admin-tone.ts";
import { AdminStatusBadge } from "../_components/admin-status-badge.tsx";
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
import { Boxes, Search } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  fabric: "Fabric",
  thread: "Thread",
  button: "Button",
  other: "Other",
};

export default function AdminInventoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const { results, status, loadMore } = useAdminInventory(
    debouncedSearch || undefined,
    20,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Inventory"
        description="Raw materials on hand across every shop."
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by material name…"
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
      ) : results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Boxes />
            </EmptyMedia>
            <EmptyTitle>No inventory items found</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "No shop has logged inventory yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reorder at</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item) => {
                const { tone, label } = inventoryTone(
                  item.quantityOnHand,
                  item.reorderThreshold,
                );
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.tenantName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantityOnHand.toLocaleString()} {item.unit}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.reorderThreshold.toLocaleString()} {item.unit}
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge tone={tone} label={label} />
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
    </div>
  );
}
