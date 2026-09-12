import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useAdminSchedule } from "@/lib/queries/admin.ts";
import { fittingTone } from "../_lib/admin-tone.ts";
import { AdminStatusBadge } from "../_components/admin-status-badge.tsx";
import { AdminErrorState } from "../_components/admin-error-state.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Truck,
} from "lucide-react";
import type {
  AdminDeliveryRow,
  AdminFittingRow,
} from "@/lib/supabase/admin-types.ts";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminSchedulePage() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const rangeStart = format(gridStart, "yyyy-MM-dd");
  const rangeEnd = format(addDays(gridEnd, 1), "yyyy-MM-dd");
  const { data, isLoading, isError, retry } = useAdminSchedule(
    rangeStart,
    rangeEnd,
  );

  const fittingsByDay = useMemo(() => {
    const map = new Map<string, AdminFittingRow[]>();
    for (const f of data?.fittings ?? []) {
      const key = format(parseISO(f.scheduledAt), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const deliveriesByDay = useMemo(() => {
    const map = new Map<string, AdminDeliveryRow[]>();
    for (const d of data?.deliveries ?? []) {
      const key = format(parseISO(d.dueDate), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const selectedFittings = fittingsByDay.get(selectedKey) ?? [];
  const selectedDeliveries = deliveriesByDay.get(selectedKey) ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Schedule"
        description="Fitting appointments and delivery dates across every shop."
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonthCursor((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium font-body w-28 text-center">
            {format(monthCursor, "MMMM yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <AdminErrorState onRetry={retry} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/40">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const fittings = fittingsByDay.get(key) ?? [];
                const deliveries = deliveriesByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, monthCursor);
                const selected = isSameDay(day, selectedDay);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-20 border-b border-r border-border p-1.5 text-left align-top transition-colors",
                      !inMonth && "bg-muted/20 text-muted-foreground/50",
                      selected && "ring-2 ring-inset ring-primary",
                      "hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-full text-xs",
                        isToday(day) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {fittings.slice(0, 3).map((f) => {
                        const { tone } = fittingTone(f.status, f.scheduledAt);
                        return (
                          <span
                            key={f.id}
                            className={cn(
                              "size-1.5 rounded-full",
                              tone === "urgent" && "bg-red-500",
                              tone === "progress" && "bg-yellow-500",
                              tone === "complete" && "bg-green-500",
                            )}
                          />
                        );
                      })}
                      {deliveries.length > 0 && (
                        <span className="text-[10px] text-muted-foreground leading-none">
                          {deliveries.length}d
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="h-fit">
            <CardContent className="py-4 space-y-4">
              <p className="text-sm font-semibold text-foreground">
                {format(selectedDay, "EEEE, dd MMM yyyy")}
              </p>

              {selectedFittings.length === 0 &&
              selectedDeliveries.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing scheduled.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedFittings.map((f) => {
                    const { tone, label } = fittingTone(
                      f.status,
                      f.scheduledAt,
                    );
                    return (
                      <div key={f.id} className="flex items-start gap-2">
                        <CalendarClock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">
                            {f.customerName}{" "}
                            <span className="text-muted-foreground">
                              · {f.tenantName}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(f.scheduledAt), "h:mm a")}
                          </p>
                        </div>
                        <AdminStatusBadge tone={tone} label={label} />
                      </div>
                    );
                  })}
                  {selectedDeliveries.map((d) => (
                    <div key={d.id} className="flex items-start gap-2">
                      <Truck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">
                          {d.orderNumber} — {d.customerName}{" "}
                          <span className="text-muted-foreground">
                            · {d.tenantName}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Delivery due
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
