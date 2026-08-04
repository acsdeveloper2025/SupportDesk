"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

interface AssetCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
}

interface ListCategoriesResponse {
  items?: AssetCategory[];
}

export default function AssetCategoriesAdminPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithCsrf("/api/asset-categories");
      if (!res.ok) throw new Error("Failed to load asset categories");
      const data = (await res.json()) as ListCategoriesResponse;
      setCategories(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load asset categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setError(null);
        const res = await fetchWithCsrf("/api/asset-categories");
        if (!res.ok) throw new Error("Failed to load asset categories");
        const data = (await res.json()) as ListCategoriesResponse;
        if (!ignore) {
          setCategories(data.items ?? []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load asset categories");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName) return;
    if (trimmedSlug && !/^[a-z0-9-]+$/.test(trimmedSlug)) {
      alert("Category slug must be lowercase alphanumeric with hyphens.");
      return;
    }

    setSubmitting(true);
    void (async () => {
      try {
        const res = await fetchWithCsrf("/api/asset-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            slug: trimmedSlug || undefined,
            parentId: parentId || undefined,
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Failed to create category");
        }
        setName("");
        setSlug("");
        setParentId("");
        setDescription("");
        await fetchCategories();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Creation failed");
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <Link href="/assets" className="text-primary text-xs hover:underline">
          ← Back to Assets
        </Link>
        <h1 className="text-foreground mt-2 text-2xl font-bold tracking-tight">Asset Categories</h1>
        <p className="text-muted-foreground text-sm">
          Hierarchy and taxonomy for CMDB Configuration Items.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="bg-card border-border space-y-4 rounded-lg border p-5">
          <h2 className="text-foreground text-base font-semibold">Add Category</h2>
          <form onSubmit={handleCreate} className="space-y-3 text-sm">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Laptops"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Slug (optional)
              </label>
              <input
                type="text"
                pattern="[a-z0-9-]+"
                title="Use only lowercase letters, digits, and hyphens."
                placeholder="e.g. laptops"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Parent Category
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              >
                <option value="">(Top level)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Create Category"}
            </button>
          </form>
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border md:col-span-2">
          <div className="border-border border-b p-4 text-sm font-semibold">
            Configured Categories
          </div>
          {loading ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              Loading categories...
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Parent</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="text-muted-foreground p-3 font-mono">{c.slug}</td>
                    <td className="text-muted-foreground p-3">{c.parent?.name ?? "(Top level)"}</td>
                    <td className="text-muted-foreground p-3">{c.description ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
