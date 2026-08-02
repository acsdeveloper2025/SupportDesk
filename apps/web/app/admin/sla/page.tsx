"use client";

import { useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface SlaHealthData {
  complianceRatePercentage: number;
  activeTimers: number;
  breachedTargets: number;
  totalPolicies: number;
}

export default function SlaAdminPage() {
  const [slaHealth, setSlaHealth] = useState<SlaHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/sla/health")
      .then((r) => (r.ok ? (r.json() as Promise<SlaHealthData>) : null))
      .then((data) => {
        if (isMounted) setSlaHealth(data);
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
            SLA Engine Administration
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            SLA compliance monitoring, business schedule configuration, and breach metrics
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">SLA Compliance Rate</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : `${slaHealth?.complianceRatePercentage ?? 100}%`}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Active SLA Timers</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {loading ? "..." : (slaHealth?.activeTimers ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">SLA Breaches</p>
            <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {loading ? "..." : (slaHealth?.breachedTargets ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Configured SLA Policies</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? "..." : (slaHealth?.totalPolicies ?? 0)}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
