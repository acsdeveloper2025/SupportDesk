"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [title, setTitle] = useState("Configuring SAML 2.0 Identity Providers");
  const [content, setContent] = useState("# Single Sign-On Setup\n\nTo configure SSO...");

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/kb/articles/${slug}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Edit Article & Publish Version
          </h1>
          <Link
            href={`/kb/articles/${slug}`}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Back to Article
          </Link>
        </div>

        <form
          onSubmit={handlePublish}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Article Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Content (Markdown)</label>
            <textarea
              required
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 p-4 font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-4 border-t border-slate-200 pt-6">
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
            >
              Publish New Version
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
