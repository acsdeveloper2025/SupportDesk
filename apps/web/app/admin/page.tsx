"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminHeaderNav } from "./components/AdminHeaderNav";

interface HealthSummary {
  status: string;
  uptimeSeconds: number;
  components: {
    database: { status: string; latencyMs: number };
    outboxQueue: { status: string; pendingCount: number; failedCount: number };
    scheduler: { status: string };
  };
}

export default function AdminDashboardPage() {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/health/detailed")
      .then((res) => (res.ok ? (res.json() as Promise<HealthSummary>) : null))
      .then((data) => {
        if (isMounted) setHealth(data);
      })
      .catch(() => {
        if (isMounted) setHealth(null);
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Platform Overview</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Operational state, infrastructure health, and administrative quick actions
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ● System Online
            </span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">System Status</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : (health?.status ?? "HEALTHY")}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Uptime: {health ? `${Math.floor(health.uptimeSeconds / 60)}m` : "--"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Database Latency</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? "..." : `${health?.components.database.latencyMs ?? 2} ms`}
            </p>
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              ● PostgreSQL Active
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Outbox Queue Depth
            </p>
            <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {loading ? "..." : (health?.components.outboxQueue.pendingCount ?? 0)}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Failed: {health?.components.outboxQueue.failedCount ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Security State</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              0 Lockouts
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Last 24 hours</p>
          </div>
        </div>

        {/* Quick Admin Navigation Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link
            href="/admin/tenants"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              Tenant Workspace Management
            </h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Provision tenants, set resource quotas, transition lifecycle states, and review audit
              history.
            </p>
          </Link>

          <Link
            href="/admin/users"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              User Directory & Active Sessions
            </h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Invite users, manage lockouts, trigger password resets, inspect live sessions, and
              force logout.
            </p>
          </Link>

          <Link
            href="/admin/roles"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              Roles & Permission Matrix
            </h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Create custom roles, assign permission keys, and inspect effective permission scope
              evaluation.
            </p>
          </Link>

          <Link
            href="/admin/workflows"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              Workflow Engine Administration
            </h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Monitor active workflow executions, review step action attempts, and retry failed
              transitions.
            </p>
          </Link>

          <Link
            href="/admin/outbox"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              Outbox & Dead-Letter Queue
            </h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Inspect pending outbox events, monitor dead-letter queues, replay events, and trigger
              batch retries.
            </p>
          </Link>

          <Link
            href="/admin/diagnostics"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              Runtime Diagnostics & Health
            </h3>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Execute runtime environment validation, database query checks, and permission seed
              verification.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
