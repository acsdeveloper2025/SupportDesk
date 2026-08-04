"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

interface AssetLocation {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
}

interface ListLocationsResponse {
  items?: AssetLocation[];
}

export default function AssetLocationsAdminPage() {
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithCsrf("/api/asset-locations");
      if (!res.ok) throw new Error("Failed to load asset locations");
      const data = (await res.json()) as ListLocationsResponse;
      setLocations(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load asset locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setError(null);
        const res = await fetchWithCsrf("/api/asset-locations");
        if (!res.ok) throw new Error("Failed to load asset locations");
        const data = (await res.json()) as ListLocationsResponse;
        if (!ignore) {
          setLocations(data.items ?? []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load asset locations");
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
    if (!name.trim()) return;

    setSubmitting(true);
    void (async () => {
      try {
        const res = await fetchWithCsrf("/api/asset-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            address: address.trim() || undefined,
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Failed to create location");
        }
        setName("");
        setAddress("");
        setDescription("");
        await fetchLocations();
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
        <h1 className="text-foreground mt-2 text-2xl font-bold tracking-tight">Asset Locations</h1>
        <p className="text-muted-foreground text-sm">
          Manage offices, data centers, floors, and sites.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="bg-card border-border space-y-4 rounded-lg border p-5">
          <h2 className="text-foreground text-base font-semibold">Add Location</h2>
          <form onSubmit={handleCreate} className="space-y-3 text-sm">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">Name</label>
              <input
                type="text"
                required
                placeholder="e.g. HQ - Floor 3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Address / Room
              </label>
              <input
                type="text"
                placeholder="e.g. 100 Main St, Suite 300"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
              {submitting ? "Saving..." : "Create Location"}
            </button>
          </form>
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border md:col-span-2">
          <div className="border-border border-b p-4 text-sm font-semibold">
            Configured Locations
          </div>
          {loading ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              Loading locations...
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {locations.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40">
                    <td className="p-3 font-medium">{l.name}</td>
                    <td className="text-muted-foreground p-3">{l.address ?? "-"}</td>
                    <td className="text-muted-foreground p-3">{l.description ?? "-"}</td>
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
