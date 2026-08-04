"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

interface AssetType {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  customFieldsSchema?: Array<{ key: string; label: string; type: string }>;
  createdAt: string;
}

interface ListTypesResponse {
  items?: AssetType[];
}

export default function AssetTypesAdminPage() {
  const [types, setTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithCsrf("/api/asset-types");
      if (!res.ok) throw new Error("Failed to load asset types");
      const data = (await res.json()) as ListTypesResponse;
      setTypes(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load asset types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setError(null);
        const res = await fetchWithCsrf("/api/asset-types");
        if (!res.ok) throw new Error("Failed to load asset types");
        const data = (await res.json()) as ListTypesResponse;
        if (!ignore) {
          setTypes(data.items ?? []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load asset types");
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
    const trimmedKey = key.trim();
    const trimmedName = name.trim();
    if (!trimmedKey || !trimmedName) return;
    if (!/^[a-z0-9_]+$/.test(trimmedKey)) {
      alert("Asset type key must be lowercase alphanumeric with underscores.");
      return;
    }

    setSubmitting(true);
    void (async () => {
      try {
        const res = await fetchWithCsrf("/api/asset-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: trimmedKey,
            name: trimmedName,
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Failed to create type");
        }
        setKey("");
        setName("");
        setDescription("");
        await fetchTypes();
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
        <h1 className="text-foreground mt-2 text-2xl font-bold tracking-tight">
          Asset Types Administration
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage system and custom CMDB Asset Types and schemas.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Creation Form */}
        <div className="bg-card border-border space-y-4 rounded-lg border p-5">
          <h2 className="text-foreground text-base font-semibold">Create Custom Asset Type</h2>
          <form onSubmit={handleCreate} className="space-y-3 text-sm">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Key (alphanumeric_snake)
              </label>
              <input
                type="text"
                required
                pattern="[a-z0-9_]+"
                title="Use only lowercase letters, digits, and underscores."
                placeholder="e.g. mobile_phone"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Mobile Phone"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              />
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
              {submitting ? "Creating..." : "Save Custom Type"}
            </button>
          </form>
        </div>

        {/* List of Types */}
        <div className="bg-card border-border overflow-hidden rounded-lg border md:col-span-2">
          <div className="border-border border-b p-4 text-sm font-semibold">
            Configured Asset Types
          </div>
          {loading ? (
            <div className="text-muted-foreground p-6 text-center text-sm">Loading types...</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Key</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {types.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40">
                    <td className="p-3 font-mono font-bold">{t.key}</td>
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3">
                      {t.isSystem ? (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/40">
                          SYSTEM
                        </span>
                      ) : (
                        <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800 dark:bg-purple-900/40">
                          CUSTOM
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground p-3">{t.description ?? "-"}</td>
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
