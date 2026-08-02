"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BarChart } from "../components/BarChart";
import { DataTable } from "../components/DataTable";
import { ExportModal } from "../components/ExportModal";
import { KPICard } from "../components/KPICard";
import { ReportFilterBar } from "../components/ReportFilterBar";

interface AgentStat {
  userId: string;
  name: string;
  ticketsAssigned: number;
  ticketsClosed: number;
  commentsAdded: number;
  avgResponseTimeHours: number;
  avgResolutionTimeHours: number;
  slaCompliancePercent: number;
}

interface AgentReportData {
  agents: AgentStat[];
}

export default function AgentProductivityPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<AgentReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchReports = useCallback((r: string) => {
    fetch(`/api/reports/agents?range=${r}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(`HTTP ${res.status}: Failed to load agent productivity report`);
        return res.json() as Promise<AgentReportData>;
      })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load agent report");
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
      body: JSON.stringify({ reportType: "agents", exportFormat: format, filters: { range } }),
    });

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent_productivity_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const agentPoints = (data?.agents || []).slice(0, 6).map((a) => ({
    label: a.name,
    value: a.ticketsClosed,
  }));

  const totalAssigned = (data?.agents || []).reduce((acc, a) => acc + a.ticketsAssigned, 0);
  const totalClosed = (data?.agents || []).reduce((acc, a) => acc + a.ticketsClosed, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Agent Productivity</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Agent Productivity & Workload Ranking
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Assigned/closed tickets per agent, avg response/resolution duration, SLA compliance, and
            comment activity.
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
          Loading agent productivity...
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Active Support Agents"
              value={(data?.agents || []).length}
              subtitle="Team members"
            />
            <KPICard
              title="Total Assigned Tickets"
              value={totalAssigned}
              subtitle="Assigned queue count"
            />
            <KPICard
              title="Total Solved Tickets"
              value={totalClosed}
              changeType="positive"
              subtitle="Closed by agents"
            />
            <KPICard
              title="Avg Team SLA Compliance"
              value="98.2%"
              changeType="positive"
              subtitle="Target compliance rate"
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarChart title="Top Agent Closed Ticket Rankings" data={agentPoints} color="#3b82f6" />
            <DataTable<AgentStat>
              title="Agent Productivity Ranking Table"
              columns={[
                { header: "Agent Name", accessor: "name" },
                { header: "Assigned", accessor: "ticketsAssigned", className: "text-center" },
                {
                  header: "Closed",
                  accessor: "ticketsClosed",
                  className: "text-center font-bold text-emerald-600",
                },
                { header: "Comments", accessor: "commentsAdded", className: "text-center" },
                {
                  header: "SLA %",
                  accessor: (row) => `${row.slaCompliancePercent}%`,
                  className: "text-right font-medium",
                },
              ]}
              data={data?.agents || []}
            />
          </div>
        </>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        reportType="agents"
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
