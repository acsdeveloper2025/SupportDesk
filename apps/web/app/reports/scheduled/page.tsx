"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { DataTable } from "../components/DataTable";

interface ScheduledReportItem {
  id: string;
  name: string;
  reportType: string;
  frequency: string;
  exportFormat: string;
  enabled: boolean;
  createdAt: string;
}

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<ScheduledReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("executive");
  const [frequency, setFrequency] = useState("daily");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [saving, setSaving] = useState(false);

  const loadSchedules = useCallback(() => {
    fetch("/api/reports/scheduled")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load scheduled reports`);
        return res.json() as Promise<ScheduledReportItem[]>;
      })
      .then((body) => {
        setSchedules(Array.isArray(body) ? body : []);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load scheduled reports");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    fetchWithCsrf("/api/reports/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        reportType,
        frequency,
        exportFormat,
        enabled: true,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to schedule report: HTTP ${res.status}`);
        setName("");
        setLoading(true);
        loadSchedules();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to schedule report");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this scheduled report job?")) return;
    setLoading(true);
    fetchWithCsrf(`/api/reports/scheduled/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to delete scheduled report: HTTP ${res.status}`);
        loadSchedules();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to delete scheduled report");
        setLoading(false);
      });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Scheduled Reports</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Scheduled Report Delivery Jobs
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Automate recurring report generation and outbox/in-app notification delivery (Daily,
            Weekly, Monthly).
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Schedule New Report Delivery
          </h2>
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Schedule Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily Executive Briefing"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Report Category
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="executive">Executive Dashboard</option>
                <option value="tickets">Ticket Analytics</option>
                <option value="sla">SLA Performance</option>
                <option value="workflows">Workflow & Automation</option>
                <option value="assets">Asset Management (CMDB)</option>
                <option value="catalog">Service Catalog</option>
                <option value="kb">Knowledge Base</option>
                <option value="agents">Agent Productivity</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Delivery Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Schedule</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Export Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="csv">CSV Stream</option>
                <option value="pdf">Formatted PDF Document</option>
                <option value="xlsx">Excel (XLSX) Spreadsheet</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? "Scheduling..." : "Create Schedule Job"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              Loading scheduled report jobs...
            </div>
          ) : (
            <DataTable<ScheduledReportItem>
              title="Active Scheduled Report Jobs"
              columns={[
                {
                  header: "Schedule Name",
                  accessor: (row) => (
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.name}
                      </span>
                      <p className="text-xs text-slate-500">
                        Format: {row.exportFormat.toUpperCase()}
                      </p>
                    </div>
                  ),
                },
                {
                  header: "Frequency",
                  accessor: (row) => (
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {row.frequency.toUpperCase()}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  accessor: () => (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active
                    </span>
                  ),
                },
                {
                  header: "Actions",
                  accessor: (row) => (
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-slate-800"
                    >
                      Delete
                    </button>
                  ),
                  className: "text-right",
                },
              ]}
              data={schedules}
            />
          )}
        </div>
      </div>
    </div>
  );
}
