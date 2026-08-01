"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";

export default function ArticleDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [feedback, setFeedback] = useState<"helpful" | "unhelpful" | null>(null);
  const [ticketIdInput, setTicketIdInput] = useState("");
  const [linkedTickets, setLinkedTickets] = useState<string[]>(["TICK-1042"]);

  const handleLinkTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketIdInput.trim()) {
      setLinkedTickets([...linkedTickets, ticketIdInput.trim()]);
      setTicketIdInput("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/kb" className="hover:text-blue-600">
            Knowledge Base
          </Link>
          <span className="mx-2">&gt;</span>
          <Link href="/kb/categories/authentication-security" className="hover:text-blue-600">
            Authentication & Security
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="truncate font-semibold text-slate-800">Configuring SAML 2.0</span>
        </nav>

        {/* Article Container */}
        <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              v1.0 • Published
            </span>
            <Link
              href={`/kb/articles/${slug}/edit`}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Edit Article &rarr;
            </Link>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Configuring SAML 2.0 Identity Providers
          </h1>

          <div className="mt-4 flex items-center gap-4 border-b border-slate-100 pb-6 text-xs text-slate-500">
            <span>Author: Security Team</span>
            <span>Published: July 28, 2026</span>
            <span>Views: 1,420</span>
          </div>

          {/* Body Content */}
          <div className="prose prose-slate max-w-none py-6">
            <p>
              SupportDesk supports federated single sign-on (SSO) using standard SAML 2.0 identity
              providers.
            </p>
            <h2 className="mb-3 mt-6 text-xl font-bold">Prerequisites</h2>
            <ul className="list-disc space-y-1 pl-5 text-slate-700">
              <li>Tenant Admin privileges in SupportDesk.</li>
              <li>Administrative access to your Identity Provider (Okta, Azure AD, OneLogin).</li>
            </ul>
          </div>

          {/* Helpful Feedback Buttons */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="mb-3 text-sm font-medium text-slate-700">Was this article helpful?</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFeedback("helpful")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  feedback === "helpful"
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                👍 Yes ({feedback === "helpful" ? 90 : 89})
              </button>
              <button
                type="button"
                onClick={() => setFeedback("unhelpful")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  feedback === "unhelpful"
                    ? "border-red-600 bg-red-50 text-red-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                👎 No ({feedback === "unhelpful" ? 3 : 2})
              </button>
            </div>
          </div>

          {/* Ticket Linking Sidebar / Section */}
          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-900">
              Linked Tickets ({linkedTickets.length})
            </h3>
            <div className="mb-4 flex flex-wrap gap-2">
              {linkedTickets.map((tId) => (
                <span
                  key={tId}
                  className="shadow-xs inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  🎫 {tId}
                </span>
              ))}
            </div>

            <form onSubmit={handleLinkTicket} className="flex gap-2">
              <input
                type="text"
                value={ticketIdInput}
                onChange={(e) => setTicketIdInput(e.target.value)}
                placeholder="Enter Ticket ID (e.g. TICK-1043)..."
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Link Ticket
              </button>
            </form>
          </div>
        </article>
      </div>
    </div>
  );
}
