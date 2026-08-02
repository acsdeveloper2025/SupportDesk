"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ExportModal } from "./components/ExportModal";
import { KPICard } from "./components/KPICard";
import { ReportFilterBar } from "./components/ReportFilterBar";

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

export default function ReportsHubPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<ExecutiveReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/executive?range=${r}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(`HTTP ${res.status}: Failed to load reports executive summary`);
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
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: "executive", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive_report_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Enterprise Reports & Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cross-module intelligence across Ticketing, SLA, Workflows, Assets, Catalog, and
            Knowledge Base.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/saved"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Saved Reports
          </Link>
          <Link
            href="/reports/scheduled"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Scheduled Jobs
          </Link>
          <Link
            href="/reports/exports"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Export Center
          </Link>
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
          Loading report metrics...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Open Tickets" value={data?.openTickets ?? 0} subtitle="Active queue" />
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
              title="Workflow Runs"
              value={data?.workflowExecutions ?? 0}
              subtitle="Executed automations"
            />
          </div>

          <h2 className="mt-10 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Domain Analytics Dashboards
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: "/reports/executive",
                title: "Executive Dashboard",
                desc: "High-level platform KPIs, system health, and cross-domain operational summary.",
              },
              {
                href: "/reports/tickets",
                title: "Ticket Analytics",
                desc: "Ticket volumes, MTTR, MTTA, priority/status distribution, and open ticket aging.",
              },
              {
                href: "/reports/sla",
                title: "SLA Performance",
                desc: "SLA compliance percentages, response vs resolution SLA, and breach priority breakdown.",
              },
              {
                href: "/reports/workflows",
                title: "Workflow & Automation",
                desc: "Execution counts, success/failure rates, retries, dead letter events, and time saved.",
              },
              {
                href: "/reports/assets",
                title: "Asset Management (CMDB)",
                desc: "Inventory count, status distribution, warranty expirations, and assignment tracking.",
              },
              {
                href: "/reports/catalog",
                title: "Service Catalog",
                desc: "Request volume, top requested services, approval stats, and fulfillment completion times.",
              },
              {
                href: "/reports/kb",
                title: "Knowledge Base",
                desc: "Published vs draft articles, views count, ticket linking, and helpfulness rating.",
              },
              {
                href: "/reports/agents",
                title: "Agent Productivity",
                desc: "Assigned/closed tickets per agent, avg resolution times, and workload distribution.",
              },
            ].map((card, idx) => (
              <Link
                key={idx}
                href={card.href}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
              >
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {card.desc}
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                  View Dashboard →
                </div>
              </Link>
            ))}
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
