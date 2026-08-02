"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BarChart } from "../components/BarChart";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface CatalogReportData {
  totalRequests: number;
  avgCompletionHours: number;
  mostRequestedServices: Array<{ name: string; count: number }>;
  approvalStatistics: { approved: number; pending: number; rejected: number; completed: number };
}

export default function CatalogReportsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<CatalogReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/catalog?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load catalog report`);
        return res.json() as Promise<CatalogReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load catalog report");
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
      body: JSON.stringify({ reportType: "catalog", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service_catalog_reports_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const topServicePoints = (data?.mostRequestedServices || []).map((s) => ({
    label: s.name,
    value: s.count,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">
          Service Catalog Reports
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Service Catalog Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Request volume, top requested service items, approval statistics, and fulfillment
            completion times.
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
          Loading catalog reports...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Service Requests"
              value={data?.totalRequests ?? 0}
              subtitle="Submitted requests"
            />
            <KPICard
              title="Awaiting Approval"
              value={data?.approvalStatistics?.pending ?? 0}
              subtitle="Pending approval steps"
            />
            <KPICard
              title="Approved & Completed"
              value={`${data?.approvalStatistics?.approved ?? 0} / ${data?.approvalStatistics?.completed ?? 0}`}
              subtitle="Approved / Completed"
            />
            <KPICard
              title="Avg Completion Time"
              value={`${data?.avgCompletionHours ?? 0} hrs`}
              subtitle="Fulfillment duration"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart
              title="Top 5 Most Requested Services"
              data={topServicePoints}
              color="#06b6d4"
            />
            <PieChart
              title="Request Approval Outcomes"
              data={[
                { label: "Approved", value: data?.approvalStatistics?.approved ?? 0 },
                { label: "Pending", value: data?.approvalStatistics?.pending ?? 0 },
                { label: "Rejected", value: data?.approvalStatistics?.rejected ?? 0 },
                { label: "Completed", value: data?.approvalStatistics?.completed ?? 0 },
              ]}
            />
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="catalog"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
