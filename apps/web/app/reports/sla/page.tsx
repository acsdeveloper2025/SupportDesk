"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BarChart } from "../components/BarChart";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface SlaReportData {
  compliancePercent: number;
  metTargets: number;
  breachedTargets: number;
  responseSla: { compliancePercent: number; met: number; total: number };
  resolutionSla: { compliancePercent: number; met: number; total: number };
  breachesByPriority: Record<string, number>;
  businessHoursVsActual: { businessHoursCompliance: number; actualCalendarCompliance: number };
}

export default function SlaReportsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<SlaReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/sla?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load SLA report`);
        return res.json() as Promise<SlaReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load SLA report");
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
      body: JSON.stringify({ reportType: "sla", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sla_reports_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const breachesPriorityPoints = Object.entries(data?.breachesByPriority || {}).map(([k, v]) => ({
    label: k,
    value: v,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">SLA Reports</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            SLA Compliance & Breach Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            SLA compliance rate, response vs resolution SLA, breaches by priority and team, business
            hours vs actual elapsed time.
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
          Loading SLA reports...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Overall Compliance"
              value={`${data?.compliancePercent ?? 100}%`}
              changeType="positive"
              subtitle="All evaluated SLA targets"
            />
            <KPICard
              title="Response SLA"
              value={`${data?.responseSla?.compliancePercent ?? 100}%`}
              subtitle={`${data?.responseSla?.met ?? 0} / ${data?.responseSla?.total ?? 0} met`}
            />
            <KPICard
              title="Resolution SLA"
              value={`${data?.resolutionSla?.compliancePercent ?? 100}%`}
              subtitle={`${data?.resolutionSla?.met ?? 0} / ${data?.resolutionSla?.total ?? 0} met`}
            />
            <KPICard
              title="Total SLA Breaches"
              value={data?.breachedTargets ?? 0}
              changeType="negative"
              subtitle="Breached SLA targets"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart
              title="SLA Breaches by Priority Level"
              data={breachesPriorityPoints}
              color="#ef4444"
            />
            <PieChart
              title="Target Met vs Breached Distribution"
              data={[
                { label: "Met Targets", value: data?.metTargets ?? 0 },
                { label: "Breached Targets", value: data?.breachedTargets ?? 0 },
              ]}
            />
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Business Hours Schedule vs Actual Elapsed Time
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Comparison between calendar elapsed time and tenant business hours schedule
              calculations.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-blue-50/50 p-4 dark:bg-blue-950/30">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Tenant Business Hours Compliance
                </span>
                <div className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {data?.businessHoursVsActual?.businessHoursCompliance ?? 100}%
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Actual Calendar Elapsed Time Compliance
                </span>
                <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-200">
                  {data?.businessHoursVsActual?.actualCalendarCompliance ?? 100}%
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="sla"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
