import React from "react";

interface ReportFilterBarProps {
  range: string;
  onRangeChange: (range: string) => void;
  onRefresh?: () => void;
  onExportClick?: () => void;
  children?: React.ReactNode;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  range,
  onRangeChange,
  onRefresh,
  onExportClick,
  children,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Date Range:
        </span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/60">
          {["7d", "30d", "90d", "1y"].map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                range === r
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>

        {children}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        )}

        {onExportClick && (
          <button
            onClick={onExportClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Export Report
          </button>
        )}
      </div>
    </div>
  );
};
