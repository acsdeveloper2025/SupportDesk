"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";

export default function CategoryDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/kb" className="hover:text-blue-600">
            Knowledge Base
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="font-semibold capitalize text-slate-800">
            {slug?.replace(/-/g, " ")}
          </span>
        </nav>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold capitalize tracking-tight text-slate-900">
            {slug?.replace(/-/g, " ")}
          </h1>
          <p className="mt-2 text-slate-600">
            Browse all published articles and subcategories in this section.
          </p>

          <div className="mt-8 divide-y divide-slate-200 border-t border-slate-200 pt-6">
            <div className="py-4">
              <Link
                href="/kb/articles/configuring-saml-20-identity-providers"
                className="text-lg font-semibold text-blue-600 hover:underline"
              >
                Configuring SAML 2.0 Identity Providers
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                Step-by-step setup guide for identity providers including Okta and Azure AD.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
