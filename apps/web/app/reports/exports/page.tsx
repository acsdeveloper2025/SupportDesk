"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DataTable } from "../components/DataTable";

interface ReportExportItem {
  id: string;
  fileName: string;
  reportType: string;
  exportFormat: string;
  status: string;
  createdAt: string;
}

export default function ExportCenterPage() {
  const [exportsList, setExportsList] = useState<ReportExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExports = useCallback(() => {
    fetch("/api/reports/exports")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load export history`);
        return res.json() as Promise<ReportExportItem[]>;
      })
      .then((body) => {
        setExportsList(Array.isArray(body) ? body : []);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load report exports");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadExports();
  }, [loadExports]);

  const handleDownload = (id: string) => {
    window.open(`/api/reports/exports/${id}/download`, "_blank");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Export Center</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Export Center & File Downloads
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Access past generated CSV, PDF, and Excel export files for auditing and offline
            reporting.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            Loading export history...
          </div>
        ) : (
          <DataTable<ReportExportItem>
            title="Generated Report Export Files"
            columns={[
              {
                header: "File Name",
                accessor: (row) => (
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.fileName}
                    </span>
                    <p className="text-xs text-slate-500">Type: {row.reportType.toUpperCase()}</p>
                  </div>
                ),
              },
              {
                header: "Format",
                accessor: (row) => (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {row.exportFormat.toUpperCase()}
                  </span>
                ),
              },
              {
                header: "Status",
                accessor: () => (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
                  </span>
                ),
              },
              {
                header: "Generated At",
                accessor: (row) => new Date(row.createdAt).toLocaleString(),
                className: "text-xs",
              },
              {
                header: "Actions",
                accessor: (row) => (
                  <button
                    onClick={() => handleDownload(row.id)}
                    className="rounded bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-slate-800"
                  >
                    Download
                  </button>
                ),
                className: "text-right",
              },
            ]}
            data={exportsList}
          />
        )}
      </div>
    </div>
  );
}
