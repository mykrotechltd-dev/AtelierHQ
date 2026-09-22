import { format, parseISO } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { useAdminNotifications } from "@/lib/queries/admin-monitoring.ts";
import type { AdminNotification } from "@/lib/supabase/admin-monitoring-types.ts";
import PageHeader from "@/components/page-header.tsx";
import Chip, { type ChipTone } from "@/components/chip.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import MonitoringUnavailable from "../_components/monitoring-unavailable.tsx";

const STATUS_TONE: Record<AdminNotification["status"], ChipTone> = {
  sent: "good",
  failed: "crit",
  skipped: "warn",
  pending: "neutral",
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  rcs: "RCS",
  sms: "SMS",
};

const TEMPLATE_LABEL: Record<string, string> = {
  order_completed: "Order completed",
  order_delivered: "Order delivered",
};

export default function AdminNotificationsPage() {
  const { data, isLoading, isError, retry } = useAdminNotifications(100);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        eyebrow="All shops · customer messages"
        title="Notifications"
        description="Every SMS/WhatsApp/RCS the platform attempted to send when an order crossed a status a customer needed to hear about — not just a record that it should have gone out."
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-none" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-5">
            <MonitoringUnavailable onRetry={retry} />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nothing sent yet. Rows appear here once a tenant is opted into
            notifications (tenants.notify_sender_name) and an order crosses
            In Progress → Completed or Completed → Delivered.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4 md:px-5"
              >
                <span className="w-28 shrink-0 pt-1 font-mono text-xs text-muted-foreground">
                  {format(parseISO(n.createdAt), "dd MMM HH:mm")}
                </span>
                <span className="min-w-0 flex-1 basis-64">
                  <span className="flex flex-wrap items-center gap-2">
                    <Chip tone={STATUS_TONE[n.status]} className="font-mono">
                      {n.status}
                    </Chip>
                    {n.channelUsed && (
                      <Chip tone="accent">
                        {CHANNEL_LABEL[n.channelUsed] ?? n.channelUsed}
                      </Chip>
                    )}
                    <b className="text-sm font-semibold">
                      {TEMPLATE_LABEL[n.templateKey] ?? n.templateKey}
                    </b>
                  </span>
                  <span className="mt-1.5 block text-[13px] text-muted-foreground">
                    {n.tenantName}
                    {n.orderNumber ? ` · Order ${n.orderNumber}` : ""}
                    {n.customerName ? ` · ${n.customerName}` : ""}
                  </span>
                  {n.lastError && (
                    <span className="mt-1 block text-[13px] text-destructive">
                      {n.lastError}
                    </span>
                  )}
                </span>
                <span className="w-20 pt-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {n.attemptCount} {n.attemptCount === 1 ? "try" : "tries"}
                </span>
                <span className="hidden w-32 pt-1 text-right font-mono text-xs text-muted-foreground sm:block">
                  {n.sentAt ? format(parseISO(n.sentAt), "dd MMM HH:mm") : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-2.5 border-t px-4 py-3.5 text-[13px] text-muted-foreground md:px-5">
          <ShieldCheck className="size-4 shrink-0" />
          Viewing this page is itself recorded, same as every other admin
          read.
        </p>
      </div>
    </div>
  );
}
