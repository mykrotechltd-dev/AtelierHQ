import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminStaff } from "@/lib/queries/admin.ts";
import { taskTone } from "../_lib/admin-tone.ts";
import { AdminStatusBadge } from "../_components/admin-status-badge.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { UserCheck, Search } from "lucide-react";

export default function AdminStaffPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const { results, status, loadMore } = useAdminStaff(
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
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
        <div className="space-y-2">
          {results.map((worker) => {
            const pending = taskTone("pending");
            const inProgress = taskTone("in_progress");
            const done = taskTone("done");
            return (
              <Card key={worker.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-sans font-semibold text-sm text-foreground">
                        {worker.name}
                        {!worker.isActive && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            (inactive)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {worker.tenantName}
                        {worker.specialization
                          ? ` · ${worker.specialization}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <AdminStatusBadge
                        tone={pending.tone}
                        label={`${worker.pendingTasks} pending`}
                      />
                      <AdminStatusBadge
                        tone={inProgress.tone}
                        label={`${worker.inProgressTasks} in progress`}
                      />
                      <AdminStatusBadge
                        tone={done.tone}
                        label={`${worker.doneTasks} done`}
                      />
                    </div>
                  </div>
                  {worker.activeTaskDescriptions.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {worker.activeTaskDescriptions.map((desc, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground truncate"
                        >
                          • {desc}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
