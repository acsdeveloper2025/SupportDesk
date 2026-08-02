"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface DiagItem {
  category: string;
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
}

export default function DiagnosticsAdminPage() {
  const [diagnostics, setDiagnostics] = useState<DiagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const runDiagnostics = useCallback(() => {
    setLoading(true);
    void fetch("/api/admin/diagnostics")
      .then((r) => (r.ok ? (r.json() as Promise<DiagItem[]>) : []))
      .then((data) => {
        setDiagnostics(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/diagnostics")
      .then((r) => (r.ok ? (r.json() as Promise<DiagItem[]>) : []))
      .then((data) => {
        if (isMounted) setDiagnostics(data);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Runtime Diagnostics</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Execute runtime environment validation, database query checks, and permission seed
              verification
            </p>
          </div>
          <button
            onClick={() => {
              runDiagnostics();
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500"
          >
            Re-run Diagnostics
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Check Name</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Diagnostic Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Executing runtime diagnostics...
                  </td>
                </tr>
              ) : diagnostics.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No diagnostic results available.
                  </td>
                </tr>
              ) : (
                diagnostics.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {d.category}
                    </td>
                    <td className="px-4 py-3 font-semibold">{d.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          d.status === "PASS"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : d.status === "WARN"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{d.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
