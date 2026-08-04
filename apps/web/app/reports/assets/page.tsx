"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { BarChart } from "../components/BarChart";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface AssetReportData {
  totalAssets: number;
  assignedAssets: number;
  unassignedAssets: number;
  utilizationPercent: number;
  assetsByStatus: Record<string, number>;
  assetsByType: Record<string, number>;
  warrantyExpiry: { expiring30Days: number; expiring60Days: number; expiring90Days: number };
}

export default function AssetReportsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<AssetReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/assets?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load asset report`);
        return res.json() as Promise<AssetReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load asset report");
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
      body: JSON.stringify({ reportType: "assets", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asset_reports_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const statusPoints = Object.entries(data?.assetsByStatus || {}).map(([k, v]) => ({
    label: k,
    value: v,
  }));

  const typePoints = Object.entries(data?.assetsByType || {}).map(([k, v]) => ({
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
        <span className="font-medium text-slate-900 dark:text-slate-100">Asset Reports</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Asset Inventory & CMDB Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Asset count, types, lifecycle status, warranty expiration tracking, assignment
            breakdown, and asset utilization.
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
          Loading asset reports...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Inventory"
              value={data?.totalAssets ?? 0}
              subtitle="Tracked CMDB items"
            />
            <KPICard
              title="Asset Utilization"
              value={`${data?.utilizationPercent ?? 0}%`}
              changeType="positive"
              subtitle="Active assigned assets"
            />
            <KPICard
              title="Assigned vs Unassigned"
              value={`${data?.assignedAssets ?? 0} / ${data?.unassignedAssets ?? 0}`}
              subtitle="Assigned / Stock"
            />
            <KPICard
              title="Warranty Expiration (30d)"
              value={data?.warrantyExpiry?.expiring30Days ?? 0}
              changeType="negative"
              subtitle="Expiring within 30 days"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart title="Assets by Lifecycle Status" data={statusPoints} color="#10b981" />
            <PieChart title="Assets by Type" data={typePoints} />
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Warranty & License Expiry Schedule
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950/40">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Expiring in 30 Days
                </span>
                <div className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {data?.warrantyExpiry?.expiring30Days ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  Expiring in 60 Days
                </span>
                <div className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {data?.warrantyExpiry?.expiring60Days ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Expiring in 90 Days
                </span>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {data?.warrantyExpiry?.expiring90Days ?? 0}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="assets"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
