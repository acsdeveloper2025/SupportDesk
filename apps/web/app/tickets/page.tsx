"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppHeaderNav } from "../components/AppHeaderNav";
import { TicketPriorityBadge } from "./components/ticket-priority-badge";
import { TicketStatusBadge } from "./components/ticket-status-badge";
import type { TicketPriority, TicketStatus, TicketType } from "./types";

interface TicketSummary {
  id: string;
  publicRef: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  channel?: string;
  requesterUserId?: string;
  assigneeUserId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ListTicketsResponse {
  items?: TicketSummary[];
  total?: number;
  page?: number;
  limit?: number;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("MEDIUM");
  const [newType, setNewType] = useState<TicketType>("INCIDENT");
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (typeFilter) params.set("type", typeFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tickets: HTTP ${res.status}`);
      }

      const data = (await res.json()) as ListTicketsResponse;
      setTickets(data.items ?? []);
      setTotalCount(data.total ?? data.items?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [page, priorityFilter, search, statusFilter, typeFilter]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (typeFilter) params.set("type", typeFilter);
    params.set("page", page.toString());
    params.set("limit", "25");

    fetch(`/api/tickets?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch tickets: HTTP ${res.status}`);
        return res.json() as Promise<ListTicketsResponse>;
      })
      .then((data) => {
        if (!ignore) {
          setTickets(data.items ?? []);
          setTotalCount(data.total ?? data.items?.length ?? 0);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load tickets.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [page, statusFilter, priorityFilter, typeFilter, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchTickets();
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    const description = newDesc.trim();
    if (!title) return;
    if (!description) {
      alert("Ticket description is required.");
      return;
    }

    setCreating(true);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const csrfData = (await csrfRes.json()) as { csrfToken?: string };

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfData.csrfToken ?? "",
        },
        body: JSON.stringify({
          title,
          description,
          priority: newPriority,
          type: newType,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => undefined)) as
          { error?: { message?: string }; message?: string } | undefined;
        throw new Error(body?.error?.message ?? body?.message ?? "Failed to create ticket");
      }

      setNewTitle("");
      setNewDesc("");
      setIsCreateOpen(false);
      void fetchTickets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create ticket");
    } finally {
      setCreating(false);
    }
  };

  // Stat metrics
  const openCount = tickets.filter((t) => t.status === "NEW" || t.status === "OPEN").length;
  const pendingCount = tickets.filter(
    (t) => t.status === "PENDING" || t.status === "ON_HOLD",
  ).length;
  const solvedCount = tickets.filter((t) => t.status === "SOLVED" || t.status === "CLOSED").length;
  const urgentCount = tickets.filter((t) => t.priority === "URGENT").length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <AppHeaderNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage enterprise support requests, incidents, and service inquiries
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            + Create New Ticket
          </button>
        </div>

        {/* Stats Metrics Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Tickets</p>
            <p className="mt-1 text-2xl font-bold">{totalCount}</p>
            <p className="mt-1 text-xs text-gray-400">In database index</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Active / Open</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{openCount}</p>
            <p className="mt-1 text-xs text-gray-400">Current page view</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Pending / On Hold
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {pendingCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">Awaiting user response</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Solved / Closed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {solvedCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">{urgentCount} Urgent priority</p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <input
                type="text"
                placeholder="Search by title or reference (e.g. TKT-1001)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="OPEN">OPEN</option>
              <option value="PENDING">PENDING</option>
              <option value="ON_HOLD">ON HOLD</option>
              <option value="SOLVED">SOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Priorities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="INCIDENT">INCIDENT</option>
              <option value="QUESTION">QUESTION</option>
              <option value="PROBLEM">PROBLEM</option>
              <option value="FEATURE_REQUEST">FEATURE REQUEST</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Search
            </button>
          </form>
        </div>

        {/* Tickets Table Container */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Reference</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Created Date</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-flex items-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                      <span>Loading tickets...</span>
                    </div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No tickets found matching current criteria.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      <Link href={`/tickets/${t.id}`} className="hover:underline">
                        {t.publicRef}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="font-semibold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                      >
                        {t.title}
                      </Link>
                      {t.description && (
                        <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                          {t.description}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <TicketStatusBadge status={t.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <TicketPriorityBadge priority={t.priority} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {t.type}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-800">
            <span className="text-xs text-gray-500">
              Showing page {page} ({tickets.length} items on page, {totalCount} total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium disabled:opacity-50 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={tickets.length < 25}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium disabled:opacity-50 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Create Ticket Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Create New Support Ticket
            </h3>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Submit an operational request or incident ticket
            </p>

            <form
              onSubmit={(e) => {
                void handleCreateTicket(e);
              }}
              className="space-y-4"
            >
              <div>
                <label
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                  htmlFor="ticket-title"
                >
                  Ticket Subject / Title
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  required
                  placeholder="e.g. Cannot connect to corporate VPN"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                  htmlFor="ticket-description"
                >
                  Detailed Description
                </label>
                <textarea
                  id="ticket-description"
                  rows={3}
                  required
                  placeholder="Provide details about the issue..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    htmlFor="ticket-priority"
                  >
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    htmlFor="ticket-type"
                  >
                    Type
                  </label>
                  <select
                    id="ticket-type"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as TicketType)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="INCIDENT">INCIDENT</option>
                    <option value="QUESTION">QUESTION</option>
                    <option value="PROBLEM">PROBLEM</option>
                    <option value="FEATURE_REQUEST">FEATURE REQUEST</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? "Submitting..." : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
