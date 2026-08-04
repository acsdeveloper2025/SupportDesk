"use client";

import { Button } from "@supportdesk/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CommentForm } from "../components/comment-form";
import { CommentItem } from "../components/comment-item";
import { EditTicketForm } from "../components/edit-ticket-form";
import { ErrorBanner } from "../components/error-banner";
import { TicketDetailSkeleton } from "../components/skeleton";
import { TicketPriorityBadge } from "../components/ticket-priority-badge";
import { TicketSection } from "../components/ticket-section";
import { TicketStatusBadge } from "../components/ticket-status-badge";
import { TimelineItem } from "../components/timeline-item";
import type {
  Comment,
  CommentListResponse,
  CreateCommentPayload,
  Ticket,
  UpdateTicketPayload,
} from "../types";

interface PageProps {
  params: Promise<{ ticketId: string }>;
}

type LoadState = "loading" | "success" | "not-found" | "forbidden" | "unauthorized" | "error";

interface AuditEvent {
  id: string;
  action: string;
  actorUserId?: string;
  createdAt: string;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf", { method: "GET" });
  const body = (await res.json()) as { csrfToken?: string };
  return body.csrfToken ?? "";
}

async function fetchWithCsrf(
  path: string,
  method: "PATCH" | "POST" | "DELETE",
  body?: unknown,
): Promise<Response> {
  const csrf = await getCsrfToken();
  return fetch(path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export default function TicketDetailPage({ params }: Readonly<PageProps>) {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<"conflict" | "generic" | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  // Track mounted state to prevent state updates on unmounted component
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resolve params (Next.js 15 async params)
  useEffect(() => {
    params
      .then(({ ticketId: tid }) => {
        if (mountedRef.current) setTicketId(tid);
      })
      .catch(() => undefined);
  }, [params]);

  // Load current user identity
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((body) => {
        if (!mountedRef.current) return;
        const b = body as { userId?: string };
        if (b.userId) setCurrentUserId(b.userId);
      })
      .catch(() => undefined);
  }, []);

  // Load all ticket data when ticketId is resolved
  useEffect(() => {
    if (!ticketId) return;

    const id = ticketId;

    Promise.all([
      fetch(`/api/tickets/${id}`),
      fetch(`/api/tickets/${id}/comments?pageSize=50`),
      fetch(`/api/tickets/${id}/timeline`),
    ])
      .then(([ticketRes, commentsRes, timelineRes]) => {
        if (!mountedRef.current) return;

        // Determine ticket load state
        if (ticketRes.status === 401) {
          setLoadState("unauthorized");
        } else if (ticketRes.status === 403) {
          setLoadState("forbidden");
        } else if (ticketRes.status === 404) {
          setLoadState("not-found");
        } else if (!ticketRes.ok) {
          setLoadState("error");
        } else {
          void readJson<Ticket>(ticketRes).then((data) => {
            if (mountedRef.current) {
              setTicket(data);
              setLoadState("success");
            }
          });
        }

        // Comments – best effort
        if (commentsRes.ok) {
          void readJson<CommentListResponse>(commentsRes).then((data) => {
            if (mountedRef.current) {
              setComments(data.items.filter((c) => c.deletedAt === null));
              setCommentsLoading(false);
            }
          });
        } else {
          setCommentsLoading(false);
        }

        // Timeline – best effort
        if (timelineRes.ok) {
          void readJson<{ items?: AuditEvent[] }>(timelineRes).then((data) => {
            if (mountedRef.current) {
              setTimeline(data.items ?? []);
              setTimelineLoading(false);
            }
          });
        } else {
          setTimelineLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setLoadState("error");
          setCommentsLoading(false);
          setTimelineLoading(false);
        }
      });
  }, [ticketId]);

  // Save edit
  async function handleSave(payload: UpdateTicketPayload) {
    if (!ticket || !ticketId) return;
    setEditError(null);
    const res = await fetchWithCsrf(`/api/tickets/${ticketId}`, "PATCH", payload);
    if (res.status === 409) {
      setEditError("conflict");
      return;
    }
    if (!res.ok) {
      setEditError("generic");
      return;
    }
    const updated = await readJson<Ticket>(res);
    setTicket(updated);
    setEditing(false);
  }

  // Add comment
  async function handleAddComment(payload: CreateCommentPayload) {
    if (!ticketId) return;
    const res = await fetchWithCsrf(`/api/tickets/${ticketId}/comments`, "POST", payload);
    if (!res.ok) throw new Error("Failed to post comment");
    const created = await readJson<Comment>(res);
    setComments((prev) => [created, ...prev]);
  }

  // Delete comment
  async function handleDeleteComment(commentId: string) {
    const res = await fetchWithCsrf(`/api/comments/${commentId}`, "DELETE");
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete comment");
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <TicketDetailSkeleton />
        </div>
      </main>
    );
  }

  if (loadState !== "success" || !ticket) {
    const errorKind =
      loadState === "not-found"
        ? "not-found"
        : loadState === "forbidden"
          ? "forbidden"
          : loadState === "unauthorized"
            ? "unauthorized"
            : "generic";

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <ErrorBanner kind={errorKind} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back navigation */}
        <nav aria-label="Breadcrumb">
          <a
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            href="/tickets"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            All tickets
          </a>
        </nav>

        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {ticket.publicRef}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {ticket.title}
            </h1>
          </div>
          {!editing ? (
            <Button
              aria-label="Edit ticket"
              onClick={() => {
                setEditing(true);
                setEditError(null);
              }}
              type="button"
              variant="secondary"
            >
              <Pencil aria-hidden="true" size={14} />
              Edit
            </Button>
          ) : null}
        </header>

        {/* Edit error banners */}
        {editError === "conflict" ? (
          <ErrorBanner
            kind="conflict"
            message="Your changes were not saved. Please refresh and try again."
          />
        ) : null}
        {editError === "generic" ? (
          <ErrorBanner kind="generic" message="Failed to save changes. Please try again." />
        ) : null}

        {/* Editing form */}
        {editing ? (
          <TicketSection title="Edit Ticket">
            <EditTicketForm
              onCancel={() => {
                setEditing(false);
                setEditError(null);
              }}
              onSave={handleSave}
              ticket={ticket}
            />
          </TicketSection>
        ) : (
          /* ── Ticket Information ── */
          <TicketSection title="Ticket Information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <FieldReadOnly label="Status">
                <TicketStatusBadge status={ticket.status} />
              </FieldReadOnly>
              <FieldReadOnly label="Priority">
                <TicketPriorityBadge priority={ticket.priority} />
              </FieldReadOnly>
              <FieldReadOnly label="Type">
                <span className="text-sm">{capitalize(ticket.type)}</span>
              </FieldReadOnly>
              <FieldReadOnly label="Channel">
                <span className="text-sm">{capitalize(ticket.channel)}</span>
              </FieldReadOnly>
              <FieldReadOnly label="Created">
                <span className="text-sm">{formatDate(ticket.createdAt)}</span>
              </FieldReadOnly>
              <FieldReadOnly label="Updated">
                <span className="text-sm">{formatDate(ticket.updatedAt)}</span>
              </FieldReadOnly>
              {ticket.dueDate ? (
                <FieldReadOnly label="Due Date">
                  <span className="text-sm">{formatDate(ticket.dueDate)}</span>
                </FieldReadOnly>
              ) : null}
              {ticket.assigneeUserId ? (
                <FieldReadOnly label="Assignee">
                  <span className="font-mono text-xs text-slate-600">
                    {ticket.assigneeUserId.slice(0, 8)}…
                  </span>
                </FieldReadOnly>
              ) : null}
              {ticket.assignedGroupId ? (
                <FieldReadOnly label="Group">
                  <span className="font-mono text-xs text-slate-600">
                    {ticket.assignedGroupId.slice(0, 8)}…
                  </span>
                </FieldReadOnly>
              ) : null}
            </dl>

            <div className="mt-5 space-y-1 border-t border-slate-100 pt-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </dt>
              <dd>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {ticket.description}
                </p>
              </dd>
            </div>
          </TicketSection>
        )}

        {/* ── Comments ── */}
        <TicketSection title="Comments">
          <div className="space-y-4">
            <CommentForm canPostInternal onSubmit={handleAddComment} />

            {commentsLoading ? (
              <p aria-busy="true" className="text-sm text-slate-400">
                Loading comments…
              </p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400">No comments yet.</p>
            ) : (
              <ul aria-label="Comments" className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <CommentItem
                      canDelete={comment.authorUserId === currentUserId}
                      comment={comment}
                      currentUserId={currentUserId}
                      onDelete={handleDeleteComment}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TicketSection>

        {/* ── Timeline ── */}
        <TicketSection title="Activity Timeline">
          {timelineLoading ? (
            <p aria-busy="true" className="text-sm text-slate-400">
              Loading timeline…
            </p>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-slate-400">No activity recorded yet.</p>
          ) : (
            <ul aria-label="Activity timeline" className="space-y-0">
              {timeline.map((event, idx) => (
                <TimelineItem
                  action={event.action}
                  actor={event.actorUserId}
                  isLast={idx === timeline.length - 1}
                  key={event.id}
                  timestamp={event.createdAt}
                />
              ))}
            </ul>
          )}
        </TicketSection>
      </div>
    </main>
  );
}

/* ── Small helpers ────────────────────────────────────────────────── */

function FieldReadOnly({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
