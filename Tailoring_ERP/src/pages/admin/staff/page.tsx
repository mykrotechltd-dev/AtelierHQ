import { Fragment, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminStaff } from "@/lib/queries/admin.ts";
import { taskTone } from "../_lib/admin-tone.ts";
import { AdminStatusBadge } from "../_components/admin-status-badge.tsx";
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
import { UserCheck, Search, ChevronDown, ChevronRight } from "lucide-react";

export default function AdminStaffPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { results, status, loadMore, retry } = useAdminStaff(
    debouncedSearch || undefined,
    20,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Staff"
        description="Tailors and their task assignments across every shop."
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by staff name…"
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
              <UserCheck />
            </EmptyMedia>
            <EmptyTitle>No staff found</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "No shop has added a worker yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Staff</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>In progress</TableHead>
                <TableHead>Done</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((worker) => {
                const isOpen = expandedId === worker.id;
                const pending = taskTone("pending");
                const inProgress = taskTone("in_progress");
                const done = taskTone("done");
                const hasTasks = worker.activeTaskDescriptions.length > 0;
                return (
                  <Fragment key={worker.id}>
                    <TableRow
                      className={hasTasks ? "cursor-pointer" : undefined}
                      onClick={() =>
                        hasTasks &&
                        setExpandedId(isOpen ? null : worker.id)
                      }
                    >
                      <TableCell>
                        {hasTasks &&
                          (isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                      <TableCell className="font-medium">
                        {worker.name}
                        {!worker.isActive && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            (inactive)
                          </span>
                        )}
                        {worker.specialization && (
                          <span className="block text-xs text-muted-foreground font-normal">
                            {worker.specialization}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {worker.tenantName}
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge
                          tone={pending.tone}
                          label={String(worker.pendingTasks)}
                        />
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge
                          tone={inProgress.tone}
                          label={String(worker.inProgressTasks)}
                        />
                      </TableCell>
                      <TableCell>
                        <AdminStatusBadge
                          tone={done.tone}
                          label={String(worker.doneTasks)}
                        />
                      </TableCell>
                    </TableRow>
                    {isOpen && hasTasks && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <ul className="py-2 space-y-1">
                            {worker.activeTaskDescriptions.map((desc, i) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground"
                              >
                                • {desc}
                              </li>
                            ))}
                          </ul>
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
