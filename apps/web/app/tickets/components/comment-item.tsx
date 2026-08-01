"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Comment } from "../types";

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  canDelete?: boolean;
  onDelete: (commentId: string) => Promise<void>;
}

export function CommentItem({
  comment,
  currentUserId,
  canDelete = false,
  onDelete,
}: Readonly<CommentItemProps>) {
  const [deleting, setDeleting] = useState(false);
  const isAuthor = currentUserId === comment.authorUserId;
  const canDeleteThis = canDelete || isAuthor;

  async function handleDelete() {
    if (!confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      aria-label={`Comment by ${comment.authorUserId}`}
      className="rounded-md border border-slate-200 bg-slate-50 p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
          >
            {comment.authorUserId.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-800">
            {comment.authorUserId.slice(0, 8)}…
          </span>
          <time
            className="text-xs text-slate-500"
            dateTime={comment.createdAt}
            title={new Date(comment.createdAt).toLocaleString()}
          >
            {formatRelativeTime(comment.createdAt)}
          </time>
        </div>
        <div className="flex items-center gap-2">
          {comment.visibility === "INTERNAL" ? (
            <span
              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              title="Internal note – not visible to the requester"
            >
              <EyeOff aria-hidden="true" size={10} />
              Internal
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500"
              title="Public comment"
            >
              <Eye aria-hidden="true" size={10} />
              Public
            </span>
          )}
          {canDeleteThis ? (
            <button
              aria-label="Delete comment"
              className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
              disabled={deleting}
              onClick={() => void handleDelete()}
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          ) : null}
        </div>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
    </article>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
