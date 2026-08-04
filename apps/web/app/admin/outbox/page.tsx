"use client";

import { useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface OutboxItem {
  id: string;
  eventType: string;
  status: string;
  retryCount: number;
  lastError?: string;
  createdAt: string;
}

interface OutboxStats {
  pendingCount: number;
  failedCount: number;
  deadLetterCount: number;
  totalProcessed: number;
}

export default function OutboxAdminPage() {
  const [stats, setStats] = useState<OutboxStats | null>(null);
  const [events, setEvents] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void Promise.all([
      fetch("/api/admin/outbox/stats").then((r) =>
        r.ok ? (r.json() as Promise<OutboxStats>) : null,
      ),
      fetch("/api/admin/outbox/events").then((r) =>
        r.ok ? (r.json() as Promise<OutboxItem[]>) : [],
      ),
    ])
      .then(([s, evts]) => {
        if (isMounted) {
          setStats(s);
          setEvents(evts);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleReplay = async (id: string) => {
    await fetchWithCsrf(`/api/admin/outbox/events/${id}/replay`, { method: "POST" });
    const [s, evts] = await Promise.all([
      fetch("/api/admin/outbox/stats").then((r) =>
        r.ok ? (r.json() as Promise<OutboxStats>) : null,
      ),
      fetch("/api/admin/outbox/events").then((r) =>
        r.ok ? (r.json() as Promise<OutboxItem[]>) : [],
      ),
    ]);
    setStats(s);
    setEvents(evts);
  };

  const handleBatchRetry = async () => {
    await fetchWithCsrf("/api/admin/outbox/events/retry-failed", { method: "POST" });
    const [s, evts] = await Promise.all([
      fetch("/api/admin/outbox/stats").then((r) =>
        r.ok ? (r.json() as Promise<OutboxStats>) : null,
      ),
      fetch("/api/admin/outbox/events").then((r) =>
        r.ok ? (r.json() as Promise<OutboxItem[]>) : [],
      ),
    ]);
    setStats(s);
    setEvents(evts);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Transactional Outbox Administration
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Monitor durable event publication, inspect dead-letter queues, and replay failed side
              effects
            </p>
          </div>
          <button
            onClick={() => {
              void handleBatchRetry();
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500"
          >
            Retry All Failed Events
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Pending Events</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats?.pendingCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Failed Events</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {stats?.failedCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Dead-Letter Queue</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {stats?.deadLetterCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">Processed Events</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats?.totalProcessed ?? 0}
            </p>
          </div>
        </div>

        {/* Event List Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Event ID</th>
                <th className="px-4 py-3 font-semibold">Event Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Retries</th>
                <th className="px-4 py-3 font-semibold">Created At</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Loading outbox events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No outbox events in queue.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {evt.id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400">
                      {evt.eventType}
                    </td>
                    <td className="px-4 py-3 font-bold">{evt.status}</td>
                    <td className="px-4 py-3">{evt.retryCount}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          void handleReplay(evt.id);
                        }}
                        className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500"
                      >
                        Replay
                      </button>
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
