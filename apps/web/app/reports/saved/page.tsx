"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { DataTable } from "../components/DataTable";

interface SavedReportItem {
  id: string;
  name: string;
  reportType: string;
  description?: string | null;
  isPublic: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

export default function SavedReportsPage() {
  const [reports, setReports] = useState<SavedReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("tickets");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSaved = useCallback(() => {
    fetch("/api/reports/saved")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load saved reports`);
        return res.json() as Promise<SavedReportItem[]>;
      })
      .then((body) => {
        setReports(Array.isArray(body) ? body : []);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load saved reports");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    fetchWithCsrf("/api/reports/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        reportType,
        description: description.trim() || undefined,
        isPublic,
        config: { range: "30d" },
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to save report: HTTP ${res.status}`);
        setName("");
        setDescription("");
        setLoading(true);
        loadSaved();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to save report");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this saved report?")) return;
    setLoading(true);
    fetchWithCsrf(`/api/reports/saved/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to delete saved report: HTTP ${res.status}`);
        loadSaved();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to delete saved report");
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
        <span className="font-medium text-slate-900 dark:text-slate-100">Saved Reports</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Saved Custom Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your custom saved report configurations and shared tenant reports.
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
            Save New Custom Report
          </h2>
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Report Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly SLA & Backlog Summary"
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
                Description (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of filters and purpose..."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Share with all tenant members (Public)
            </label>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {saving ? "Saving..." : "Save Report Configuration"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              Loading saved reports...
            </div>
          ) : (
            <DataTable<SavedReportItem>
              title="Saved Report Configurations"
              columns={[
                {
                  header: "Report Name",
                  accessor: (row) => (
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.name}
                      </span>
                      {row.description && (
                        <p className="text-xs text-slate-500">{row.description}</p>
                      )}
                    </div>
                  ),
                },
                {
                  header: "Category",
                  accessor: (row) => (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {row.reportType.toUpperCase()}
                    </span>
                  ),
                },
                {
                  header: "Visibility",
                  accessor: (row) => (row.isPublic ? "Shared" : "Private"),
                  className: "text-xs",
                },
                {
                  header: "Actions",
                  accessor: (row) => (
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/reports/${row.reportType}`}
                        className="rounded px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-slate-800"
                      >
                        Delete
                      </button>
                    </div>
                  ),
                  className: "text-right",
                },
              ]}
              data={reports}
            />
          )}
        </div>
      </div>
    </div>
  );
}
