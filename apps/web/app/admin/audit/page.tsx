"use client";

import { useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface AuditLog {
  id: string;
  action: string;
  actorUserId?: string;
  outcome: string;
  createdAt: string;
}

interface SecurityDashboardData {
  failedLogins: number;
  accountLocks: number;
  permissionChanges: number;
  totalEvents: number;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
}

export default function AuditAdminPage() {
  const [security, setSecurity] = useState<SecurityDashboardData | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      fetch("/api/admin/audit/security-dashboard").then((r) =>
        r.ok ? (r.json() as Promise<SecurityDashboardData>) : null,
      ),
      fetch("/api/admin/audit/logs").then((r) =>
        r.ok ? (r.json() as Promise<AuditLogResponse>) : { logs: [], total: 0 },
      ),
    ])
      .then(([sec, l]) => {
        if (isMounted) {
          setSecurity(sec);
          setLogs(l.logs ?? []);
        }
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
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Audit Explorer & Security Dashboard
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Immutable audit evidence, failed login tracking, and account lockout events
          </p>
        </div>

        {/* Security Metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Failed Logins (24h)</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {security?.failedLogins ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Account Lockouts (24h)</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {security?.accountLocks ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Permission Changes (24h)</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {security?.permissionChanges ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Total Audited Events (24h)</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {security?.totalEvents ?? 0}
            </p>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Event ID</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Actor ID</th>
                <th className="px-4 py-3 font-semibold">Outcome</th>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No recent audit events found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {log.id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {log.actorUserId?.substring(0, 8) ?? "System"}
                    </td>
                    <td className="px-4 py-3 font-bold">{log.outcome}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
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
