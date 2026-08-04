"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { BarChart } from "../components/BarChart";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface ExecutiveReportData {
  openTickets: number;
  closedTickets: number;
  slaComplianceRate: number;
  slaBreaches: number;
  workflowExecutions: number;
  assetSummary: { total: number; assigned: number; unassigned: number };
  serviceRequests: { total: number; pendingApproval: number };
  kbUsage: { totalArticles: number; viewsCount: number };
  systemHealthSummary: { status: string; database: string; outboxQueue: string; slaEngine: string };
}

export default function ExecutiveDashboardPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<ExecutiveReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/executive?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load executive dashboard`);
        return res.json() as Promise<ExecutiveReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load report data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchReports(range);
  }, [fetchReports, range]);

  const handleRefresh = () => {
    setLoading(true);
    fetchReports(range);
  };

  const handleExport = async (format: "csv" | "pdf" | "xlsx") => {
    const res = await fetchWithCsrf("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "executive", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive_dashboard_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Executive Dashboard</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Executive Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            High-level metrics across tickets, SLA compliance, workflow execution, asset inventory,
            and service requests.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ReportFilterBar
          range={range}
          onRangeChange={(r) => {
            setLoading(true);
            setRange(r);
          }}
          onRefresh={handleRefresh}
          onExportClick={() => setExportModalOpen(true)}
        />
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex h-64 items-center justify-center text-sm text-slate-400">
          Loading executive metrics...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Open Tickets"
              value={data?.openTickets ?? 0}
              subtitle="Active support queue"
            />
            <KPICard
              title="Closed Tickets"
              value={data?.closedTickets ?? 0}
              subtitle="Resolved in period"
            />
            <KPICard
              title="SLA Compliance"
              value={`${data?.slaComplianceRate ?? 100}%`}
              changeType={(data?.slaComplianceRate ?? 100) >= 95 ? "positive" : "negative"}
              change={`${data?.slaBreaches ?? 0} breaches`}
            />
            <KPICard
              title="Workflow Executions"
              value={data?.workflowExecutions ?? 0}
              subtitle="Automated workflow steps"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart
              title="Asset Breakdown by Assignment Status"
              data={[
                { label: "Total Assets", value: data?.assetSummary?.total ?? 0 },
                { label: "Assigned", value: data?.assetSummary?.assigned ?? 0 },
                { label: "Unassigned", value: data?.assetSummary?.unassigned ?? 0 },
              ]}
              color="#10b981"
            />

            <PieChart
              title="Service Requests Summary"
              data={[
                { label: "Total Requests", value: data?.serviceRequests?.total ?? 0 },
                { label: "Awaiting Approval", value: data?.serviceRequests?.pendingApproval ?? 0 },
              ]}
            />
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              System Health & Operational Status
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Core Platform Status",
                  val: data?.systemHealthSummary?.status || "OPERATIONAL",
                },
                { label: "Database Engine", val: data?.systemHealthSummary?.database || "HEALTHY" },
                {
                  label: "Outbox Queue Worker",
                  val: data?.systemHealthSummary?.outboxQueue || "HEALTHY",
                },
                {
                  label: "SLA Calculation Engine",
                  val: data?.systemHealthSummary?.slaEngine || "ACTIVE",
                },
              ].map((item, idx) => (
                <div key={idx} className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {item.label}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.val}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="executive"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
