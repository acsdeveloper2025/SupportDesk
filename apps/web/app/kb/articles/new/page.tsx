"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function CreateArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("cat-1");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("sso, authentication");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate save draft
    router.push("/kb");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Create Knowledge Base Article
          </h1>
          <Link href="/kb" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Cancel
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Article Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to configure SSO..."
              className="mt-1 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="cat-1">Getting Started</option>
                <option value="cat-2">Authentication & Security</option>
                <option value="cat-3">Ticket Management</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="PUBLIC">Public (All Requesters & Agents)</option>
                <option value="INTERNAL">Internal (Agents & Admins Only)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary..."
              className="mt-1 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Article Content (Markdown)
            </label>
            <textarea
              required
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write rich text or Markdown content here..."
              className="mt-1 w-full rounded-md border border-slate-300 p-4 font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="sso, saml, security"
              className="mt-1 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-4 border-t border-slate-200 pt-6">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Save Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
