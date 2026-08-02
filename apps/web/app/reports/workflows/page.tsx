"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BarChart } from "../components/BarChart";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface WorkflowReportData {
  totalExecutions: number;
  successRatePercent: number;
  succeeded: number;
  failed: number;
  retryCount: number;
  deadLettered: number;
  automationTimeSavedHours: number;
  runtimeStatistics: { avgExecutionDurationMs: number };
}

export default function WorkflowReportsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<WorkflowReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/workflows?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load workflow report`);
        return res.json() as Promise<WorkflowReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load workflow report");
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
      body: JSON.stringify({ reportType: "workflows", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow_reports_${Date.now()}.${format}`;
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
        <span className="font-medium text-slate-900 dark:text-slate-100">Workflow Reports</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Workflow & Automation Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Workflow execution metrics, success & failure rates, retries, dead letter events,
            estimated automation time saved.
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
          Loading workflow reports...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Executions"
              value={data?.totalExecutions ?? 0}
              subtitle="Executed triggers"
            />
            <KPICard
              title="Success Rate"
              value={`${data?.successRatePercent ?? 100}%`}
              changeType="positive"
              subtitle={`${data?.succeeded ?? 0} succeeded`}
            />
            <KPICard
              title="Retries / Dead Letters"
              value={`${data?.retryCount ?? 0} / ${data?.deadLettered ?? 0}`}
              changeType="negative"
              subtitle="Error handling events"
            />
            <KPICard
              title="Automation Time Saved"
              value={`${data?.automationTimeSavedHours ?? 0} hrs`}
              changeType="positive"
              subtitle="Estimated agent time saved"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PieChart
              title="Execution Outcome Distribution"
              data={[
                { label: "Succeeded", value: data?.succeeded ?? 0 },
                { label: "Failed", value: data?.failed ?? 0 },
                { label: "Dead Lettered", value: data?.deadLettered ?? 0 },
              ]}
            />
            <BarChart
              title="Runtime Performance Summary"
              data={[
                {
                  label: "Avg Duration (ms)",
                  value: data?.runtimeStatistics?.avgExecutionDurationMs ?? 145,
                },
                { label: "Retries Count", value: data?.retryCount ?? 0 },
                { label: "Time Saved (hrs)", value: data?.automationTimeSavedHours ?? 0 },
              ]}
              color="#8b5cf6"
            />
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="workflows"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
