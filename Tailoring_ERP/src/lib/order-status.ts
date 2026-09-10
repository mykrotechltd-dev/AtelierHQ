/** Order status display/workflow config, shared by the badge, the orders
 *  list's empty-state copy, and the order detail's advance-status action. */
export const STATUS_CONFIG = {
  received: {
    label: "Received",
    next: "in_progress",
    nextLabel: "Start work",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  in_progress: {
    label: "In Progress",
    next: "completed",
    nextLabel: "Mark completed",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Completed",
    next: "delivered",
    nextLabel: "Mark delivered",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  delivered: {
    label: "Delivered",
    next: null,
    nextLabel: null,
    color: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
} as const;

export type OrderStatus = keyof typeof STATUS_CONFIG;
