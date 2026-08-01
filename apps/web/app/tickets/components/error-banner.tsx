import { AlertCircle, AlertTriangle, Lock, RefreshCcw, WifiOff } from "lucide-react";

type ErrorKind = "not-found" | "forbidden" | "unauthorized" | "conflict" | "network" | "generic";

interface ErrorBannerProps {
  kind: ErrorKind;
  message?: string;
  onRetry?: () => void;
}

const ERROR_CONFIG: Record<ErrorKind, { icon: React.ReactNode; title: string; color: string }> = {
  "not-found": {
    icon: <AlertCircle aria-hidden="true" size={18} />,
    title: "Ticket not found",
    color: "border-slate-200 bg-slate-50 text-slate-700",
  },
  forbidden: {
    icon: <Lock aria-hidden="true" size={18} />,
    title: "You do not have permission to view this ticket",
    color: "border-red-200 bg-red-50 text-red-700",
  },
  unauthorized: {
    icon: <Lock aria-hidden="true" size={18} />,
    title: "You must be signed in to view this ticket",
    color: "border-amber-200 bg-amber-50 text-amber-700",
  },
  conflict: {
    icon: <AlertTriangle aria-hidden="true" size={18} />,
    title: "This ticket was updated by another user",
    color: "border-amber-200 bg-amber-50 text-amber-700",
  },
  network: {
    icon: <WifiOff aria-hidden="true" size={18} />,
    title: "Network error",
    color: "border-slate-200 bg-slate-50 text-slate-700",
  },
  generic: {
    icon: <AlertCircle aria-hidden="true" size={18} />,
    title: "Something went wrong",
    color: "border-red-200 bg-red-50 text-red-700",
  },
};

export function ErrorBanner({ kind, message, onRetry }: Readonly<ErrorBannerProps>) {
  const config = ERROR_CONFIG[kind];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${config.color}`} role="alert">
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{config.title}</p>
        {message ? <p className="mt-1 text-sm opacity-80">{message}</p> : null}
        {kind === "conflict" ? (
          <p className="mt-1 text-sm opacity-80">
            Please refresh the page to see the latest version before making changes.
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          className="ml-auto shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
          onClick={onRetry}
          type="button"
        >
          <RefreshCcw aria-hidden="true" className="mr-1 inline" size={14} />
          Retry
        </button>
      ) : null}
    </div>
  );
}
