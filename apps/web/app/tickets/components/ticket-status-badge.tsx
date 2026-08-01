import type { TicketStatus } from "../types";

const STATUS_CONFIG: Record<TicketStatus, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-slate-100 text-slate-700 border-slate-200" },
  OPEN: { label: "Open", className: "bg-blue-50 text-blue-700 border-blue-200" },
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ON_HOLD: { label: "On Hold", className: "bg-orange-50 text-orange-700 border-orange-200" },
  SOLVED: { label: "Solved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CLOSED: { label: "Closed", className: "bg-slate-200 text-slate-600 border-slate-300" },
};

export function TicketStatusBadge({ status }: Readonly<{ status: TicketStatus }>) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
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
