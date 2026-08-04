"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { BarChart } from "../components/BarChart";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { LineChart } from "../components/LineChart";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface TicketReportData {
  totalTickets: number;
  mttrHours: number;
  mttaHours: number;
  reopenedTickets: number;
  escalations: number;
  statusDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
  agingReport: {
    under1d: number;
    "1to3d": number;
    "3to7d": number;
    "7to14d": number;
    "14to30d": number;
    over30d: number;
  };
  backlogTrend: Array<{ label: string; open: number }>;
}

export default function TicketAnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<TicketReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/tickets?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load ticket analytics`);
        return res.json() as Promise<TicketReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load ticket analytics");
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
      body: JSON.stringify({ reportType: "tickets", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket_analytics_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const statusPoints = Object.entries(data?.statusDistribution || {}).map(([k, v]) => ({
    label: k,
    value: v,
  }));

  const priorityPoints = Object.entries(data?.priorityDistribution || {}).map(([k, v]) => ({
    label: k,
    value: v,
  }));

  const agingPoints = [
    { label: "< 1 day", value: data?.agingReport?.under1d ?? 0 },
    { label: "1-3 days", value: data?.agingReport?.["1to3d"] ?? 0 },
    { label: "3-7 days", value: data?.agingReport?.["3to7d"] ?? 0 },
    { label: "7-14 days", value: data?.agingReport?.["7to14d"] ?? 0 },
    { label: "14-30 days", value: data?.agingReport?.["14to30d"] ?? 0 },
    { label: "> 30 days", value: data?.agingReport?.over30d ?? 0 },
  ];

  const backlogPoints = (data?.backlogTrend || []).map((b) => ({
    label: b.label,
    value: b.open,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Ticket Analytics</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Ticket Analytics & Aging Report
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Volume, status & priority distribution, MTTR, MTTA, ticket aging brackets, reopened
            tickets, and escalations.
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
          Loading ticket analytics...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Volume"
              value={data?.totalTickets ?? 0}
              subtitle="Created in window"
            />
            <KPICard
              title="Mean Time to Resolve (MTTR)"
              value={`${data?.mttrHours ?? 0} hrs`}
              subtitle="Avg resolution duration"
            />
            <KPICard
              title="Mean Time to Acknowledge (MTTA)"
              value={`${data?.mttaHours ?? 0} hrs`}
              subtitle="Avg first response duration"
            />
            <KPICard
              title="Reopened / Escalated"
              value={`${data?.reopenedTickets ?? 0} / ${data?.escalations ?? 0}`}
              subtitle="Reopened / Urgent priority"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart title="Ticket Status Distribution" data={statusPoints} color="#3b82f6" />
            <PieChart title="Priority Distribution" data={priorityPoints} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart
              title="Open Ticket Aging Report (Days Open)"
              data={agingPoints}
              color="#f59e0b"
            />
            <LineChart title="Backlog Trend (Open Tickets)" data={backlogPoints} color="#ec4899" />
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="tickets"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
