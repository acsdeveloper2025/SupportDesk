"use client";

import Link from "next/link";
import React, { useState } from "react";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export default function CategoryAdminPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: "cat-1", name: "Getting Started", slug: "getting-started", description: "Setup guides" },
    {
      id: "cat-2",
      name: "Authentication & Security",
      slug: "authentication-security",
      description: "SSO and RBAC",
    },
  ]);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      setCategories([
        ...categories,
        {
          id: `cat-${Date.now()}`,
          name: newName.trim(),
          slug: newName.toLowerCase().replace(/[^\w-]/g, ""),
          description: newDesc.trim(),
        },
      ]);
      setNewName("");
      setNewDesc("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Category Management</h1>
          <Link href="/kb" className="text-sm font-semibold text-blue-600 hover:underline">
            &larr; Back to Knowledge Base
          </Link>
        </div>

        {/* Add Category Form */}
        <form
          onSubmit={handleAddCategory}
          className="mb-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold text-slate-900">Add New Category</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Billing & Invoicing"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short description..."
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Create Category
          </button>
        </form>

        {/* Categories Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Slug</th>
                <th className="px-6 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{c.slug}</td>
                  <td className="px-6 py-4 text-slate-600">{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
