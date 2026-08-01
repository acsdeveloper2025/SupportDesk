"use client";

import Link from "next/link";
import React, { useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  _count?: { articles: number };
}

interface Article {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  viewsCount: number;
  helpfulCount: number;
  publishedAt?: string;
  category?: { name: string; slug: string };
}

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const sampleCategories: Category[] = [
    {
      id: "cat-1",
      name: "Getting Started",
      slug: "getting-started",
      description: "Setup guides, onboarding, and baseline platform configuration.",
      icon: "book-open",
      _count: { articles: 12 },
    },
    {
      id: "cat-2",
      name: "Authentication & Security",
      slug: "authentication-security",
      description: "SSO configuration, SAML 2.0, multi-factor auth, and RBAC policies.",
      icon: "shield-check",
      _count: { articles: 8 },
    },
    {
      id: "cat-3",
      name: "Ticket Management",
      slug: "ticket-management",
      description: "Workflows, automations, SLA schedules, and ticket routing.",
      icon: "ticket",
      _count: { articles: 15 },
    },
  ];

  const samplePopularArticles: Article[] = [
    {
      id: "art-1",
      title: "Configuring SAML 2.0 Identity Providers",
      slug: "configuring-saml-20-identity-providers",
      summary: "Step-by-step instructions for Okta, Azure AD, and PingIdentity integration.",
      viewsCount: 1420,
      helpfulCount: 89,
      publishedAt: "2026-07-28T10:00:00Z",
      category: { name: "Authentication & Security", slug: "authentication-security" },
    },
    {
      id: "art-2",
      title: "Creating Custom Ticket Automation Workflows",
      slug: "creating-custom-ticket-automation-workflows",
      summary:
        "Learn how to build event-driven trigger rules with conditions and automated actions.",
      viewsCount: 980,
      helpfulCount: 64,
      publishedAt: "2026-07-29T14:30:00Z",
      category: { name: "Ticket Management", slug: "ticket-management" },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header Banner */}
      <div className="bg-slate-900 px-6 py-16 text-center text-white shadow-md">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Knowledge Base</h1>
          <p className="mt-4 text-lg text-slate-300">
            Find answers, technical documentation, and step-by-step troubleshooting guides.
          </p>

          {/* Search Bar */}
          <div className="mt-8 flex justify-center">
            <div className="relative w-full max-w-2xl">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, topics, or error messages..."
                className="w-full rounded-lg bg-white px-5 py-4 pl-12 text-slate-900 shadow-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-4 top-4 h-6 w-6 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Categories Section */}
        <section className="mb-16">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Browse Categories</h2>
            <Link
              href="/kb/admin/categories"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage Categories &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sampleCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/kb/categories/${cat.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-500 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                    <span className="text-xl font-bold uppercase">{cat.name.charAt(0)}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {cat._count?.articles ?? 0} articles
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600">
                  {cat.name}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{cat.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Popular Articles Section */}
        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Popular Articles</h2>
            <Link
              href="/kb/articles/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              + Create Article Draft
            </Link>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
            {samplePopularArticles.map((art) => (
              <div key={art.id} className="p-6 transition hover:bg-slate-50">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-blue-600">
                  <span>{art.category?.name}</span>
                </div>
                <Link
                  href={`/kb/articles/${art.slug}`}
                  className="text-lg font-semibold text-slate-900 hover:text-blue-600"
                >
                  {art.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{art.summary}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span>👁️ {art.viewsCount} views</span>
                  <span>👍 {art.helpfulCount} helpful</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
