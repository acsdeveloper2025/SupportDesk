import { Circle } from "lucide-react";

interface TimelineItemProps {
  action: string;
  actor?: string;
  timestamp: string;
  isLast?: boolean;
}

export function TimelineItem({
  action,
  actor,
  timestamp,
  isLast = false,
}: Readonly<TimelineItemProps>) {
  return (
    <li className="relative flex gap-3">
      {/* Connector line */}
      {!isLast ? (
        <span aria-hidden="true" className="absolute bottom-0 left-[9px] top-5 w-px bg-slate-200" />
      ) : null}
      <Circle
        aria-hidden="true"
        className="text-brand-accent relative mt-0.5 shrink-0"
        fill="currentColor"
        size={18}
      />
      <div className="pb-4">
        <p className="text-sm text-slate-800">
          {action}
          {actor ? <span className="font-medium"> — {actor}</span> : null}
        </p>
        <time
          className="text-xs text-slate-500"
          dateTime={timestamp}
          title={new Date(timestamp).toLocaleString()}
        >
          {new Date(timestamp).toLocaleString()}
        </time>
      </div>
    </li>
  );
}
