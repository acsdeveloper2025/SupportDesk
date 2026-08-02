"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DataTable } from "../components/DataTable";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { PieChart } from "../components/PieChart";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface KbReportData {
  totalArticles: number;
  published: number;
  draft: number;
  archived: number;
  feedback: { helpfulnessRatePercent: number; helpful: number; unhelpful: number };
  mostViewedArticles: Array<{ title: string; views: number }>;
  mostLinkedArticles: Array<{ title: string; links: number }>;
}

export default function KbReportsPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<KbReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/kb?range=${r}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load KB report`);
        return res.json() as Promise<KbReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load KB report");
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
      body: JSON.stringify({ reportType: "kb", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kb_reports_${Date.now()}.${format}`;
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
        <span className="font-medium text-slate-900 dark:text-slate-100">
          Knowledge Base Reports
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Knowledge Base Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Article status counts, view metrics, ticket/asset linking, helpfulness ratings, and
            article usage.
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
          Loading KB reports...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total KB Articles"
              value={data?.totalArticles ?? 0}
              subtitle="Articles in knowledge base"
            />
            <KPICard
              title="Published vs Draft"
              value={`${data?.published ?? 0} / ${data?.draft ?? 0}`}
              subtitle="Published / Drafts"
            />
            <KPICard
              title="Helpfulness Rate"
              value={`${data?.feedback?.helpfulnessRatePercent ?? 100}%`}
              changeType="positive"
              subtitle={`${data?.feedback?.helpful ?? 0} helpful votes`}
            />
            <KPICard
              title="Unhelpful Votes"
              value={data?.feedback?.unhelpful ?? 0}
              changeType="negative"
              subtitle="Articles needing review"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PieChart
              title="Article Publication Status"
              data={[
                { label: "Published", value: data?.published ?? 0 },
                { label: "Draft", value: data?.draft ?? 0 },
                { label: "Archived", value: data?.archived ?? 0 },
              ]}
            />

            <DataTable<{ title: string; views: number }>
              title="Most Viewed Articles"
              columns={[
                { header: "Article Title", accessor: "title" },
                { header: "Views", accessor: "views", className: "text-right font-semibold" },
              ]}
              data={data?.mostViewedArticles || []}
            />
          </div>

          <div className="mt-8">
            <DataTable<{ title: string; links: number }>
              title="Most Linked Articles (Tickets & Assets)"
              columns={[
                { header: "Article Title", accessor: "title" },
                { header: "Total Links", accessor: "links", className: "text-right font-semibold" },
              ]}
              data={data?.mostLinkedArticles || []}
            />
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="kb"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
