"use client";

import { useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface NotificationMonitoringData {
  totalSent: number;
  pendingIntents: number;
  failedIntents: number;
}

export default function NotificationsAdminPage() {
  const [monitoring, setMonitoring] = useState<NotificationMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/notifications/monitoring")
      .then((r) => (r.ok ? (r.json() as Promise<NotificationMonitoringData>) : null))
      .then((data) => {
        if (isMounted) setMonitoring(data);
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
            Notification Administration
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Delivery queues, template preferences, and notification intent tracking
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Total Notifications Dispatched</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : (monitoring?.totalSent ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Pending Intents</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {loading ? "..." : (monitoring?.pendingIntents ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Failed Dispatches</p>
            <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {loading ? "..." : (monitoring?.failedIntents ?? 0)}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
