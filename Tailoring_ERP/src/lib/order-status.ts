/** Order status display/workflow config, shared by the badge, the orders
 *  list's empty-state copy, and the order detail's advance-status action. */
export const STATUS_CONFIG = {
  received: {
    label: "Received",
    next: "in_progress",
    nextLabel: "Start work",
    color: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    next: "completed",
    nextLabel: "Mark completed",
    color: "bg-accent text-accent-foreground",
    dot: "bg-primary",
  },
  completed: {
    label: "Completed",
    next: "delivered",
    nextLabel: "Mark delivered",
    color: "bg-success-soft text-success",
    dot: "bg-success",
  },
  delivered: {
    label: "Delivered",
    next: null,
    nextLabel: null,
    color: "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
    dot: "bg-border",
  },
} as const;

export type OrderStatus = keyof typeof STATUS_CONFIG;
