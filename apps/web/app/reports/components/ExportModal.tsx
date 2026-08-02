import React, { useState } from "react";

interface ExportModalProps {
  isOpen: boolean;
  reportType: string;
  onClose: () => void;
  onExport: (format: "csv" | "pdf" | "xlsx") => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  reportType,
  onClose,
  onExport,
}) => {
  const [format, setFormat] = useState<"csv" | "pdf" | "xlsx">("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    onExport(format)
      .then(() => {
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to export report");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Export {reportType.toUpperCase()} Report
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose export format for offline analysis and auditing.
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "csv", label: "CSV", desc: "Raw data stream" },
              { id: "pdf", label: "PDF", desc: "Formatted document" },
              { id: "xlsx", label: "Excel (XLSX)", desc: "Spreadsheet ML" },
            ].map((fmt) => (
              <label
                key={fmt.id}
                className={`flex cursor-pointer flex-col rounded-xl border p-3 text-center transition-all ${
                  format === fmt.id
                    ? "border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={fmt.id}
                  checked={format === fmt.id}
                  onChange={() => setFormat(fmt.id as "csv" | "pdf" | "xlsx")}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {fmt.label}
                </span>
                <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {fmt.desc}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {loading ? "Exporting..." : "Download Export"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
