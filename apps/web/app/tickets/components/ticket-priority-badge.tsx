import type { TicketPriority } from "../types";

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200" },
  MEDIUM: { label: "Medium", className: "bg-blue-50 text-blue-700 border-blue-200" },
  HIGH: { label: "High", className: "bg-amber-50 text-amber-700 border-amber-200" },
  URGENT: { label: "Urgent", className: "bg-red-50 text-red-700 border-red-200" },
};

export function TicketPriorityBadge({ priority }: Readonly<{ priority: TicketPriority }>) {
  const config = PRIORITY_CONFIG[priority] ?? {
    label: priority,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
