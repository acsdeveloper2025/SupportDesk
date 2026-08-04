"use client";

import { useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface ExecutionItem {
  id: string;
  status: string;
  startedAt: string;
  errorMessage?: string;
  workflowVersion?: { workflow?: { name: string } };
}

interface WorkflowMonitoring {
  totalWorkflows: number;
  activeExecutions: number;
  failedExecutions: number;
  pausedWorkflows: number;
}

export default function WorkflowsAdminPage() {
  const [monitoring, setMonitoring] = useState<WorkflowMonitoring | null>(null);
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void Promise.all([
      fetch("/api/admin/workflows/monitoring").then((r) =>
        r.ok ? (r.json() as Promise<WorkflowMonitoring>) : null,
      ),
      fetch("/api/admin/workflows/executions").then((r) =>
        r.ok ? (r.json() as Promise<ExecutionItem[]>) : [],
      ),
    ])
      .then(([mon, execs]) => {
        if (isMounted) {
          setMonitoring(mon);
          setExecutions(execs);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRetry = async (id: string) => {
    await fetchWithCsrf(`/api/admin/workflows/executions/${id}/retry`, { method: "POST" });
    const [mon, execs] = await Promise.all([
      fetch("/api/admin/workflows/monitoring").then((r) =>
        r.ok ? (r.json() as Promise<WorkflowMonitoring>) : null,
      ),
      fetch("/api/admin/workflows/executions").then((r) =>
        r.ok ? (r.json() as Promise<ExecutionItem[]>) : [],
      ),
    ]);
    setMonitoring(mon);
    setExecutions(execs);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Workflow Administration
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Monitor workflow execution state, paused definitions, and retry failed transitions
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Total Workflows</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {monitoring?.totalWorkflows ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Running Executions</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {monitoring?.activeExecutions ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Failed Executions</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {monitoring?.failedExecutions ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Paused Workflows</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {monitoring?.pausedWorkflows ?? 0}
            </p>
          </div>
        </div>

        {/* Executions Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Execution ID</th>
                <th className="px-4 py-3 font-semibold">Workflow</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Started At</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading workflow executions...
                  </td>
                </tr>
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No active workflow executions found.
                  </td>
                </tr>
              ) : (
                executions.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-semibold">{e.id.substring(0, 8)}...</td>
                    <td className="px-4 py-3">{e.workflowVersion?.workflow?.name ?? "Workflow"}</td>
                    <td className="px-4 py-3 font-bold">{e.status}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(e.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.status === "FAILED" && (
                        <button
                          onClick={() => {
                            void handleRetry(e.id);
                          }}
                          className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500"
                        >
                          Retry Step
                        </button>
                      )}
                    </td>
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
