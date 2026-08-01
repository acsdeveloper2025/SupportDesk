"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Asset {
  id: string;
  assetRef: string;
  name: string;
  lifecycleState: string;
  serialNumber?: string | null;
  assetTag?: string | null;
  assetType?: { id: string; name: string; key: string };
  category?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
  assignedUser?: { id: string; email: string } | null;
  assignedDepartment?: string | null;
  createdAt: string;
}

interface ListAssetsResponse {
  items?: Asset[];
  totalRecords?: number;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState("");

  const loadAssets = async (searchQuery: string, stateFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (stateFilter) params.set("lifecycleState", stateFilter);

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load assets: HTTP ${res.status}`);
      }
      const data = (await res.json()) as ListAssetsResponse;
      setAssets(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (filterState) params.set("lifecycleState", filterState);

        const res = await fetch(`/api/assets?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load assets: HTTP ${res.status}`);
        }
        const data = (await res.json()) as ListAssetsResponse;
        if (!ignore) {
          setAssets(data.items ?? []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load assets");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void loadInitial();
    return () => {
      ignore = true;
    };
  }, [filterState, query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadAssets(query, filterState);
  };

  const getLifecycleColor = (state: string) => {
    switch (state) {
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "IN_STOCK":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "IN_REPAIR":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      case "RETIRED":
      case "DISPOSED":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "LOST":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      default:
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    }
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Asset Management (CMDB)
          </h1>
          <p className="text-muted-foreground text-sm">
            Track hardware, software licenses, infrastructure assets, and Configuration Items.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/assets/types"
            className="border-input hover:bg-accent rounded-md border px-3 py-2 text-sm font-medium"
          >
            Asset Types
          </Link>
          <Link
            href="/assets/categories"
            className="border-input hover:bg-accent rounded-md border px-3 py-2 text-sm font-medium"
          >
            Categories
          </Link>
          <Link
            href="/assets/locations"
            className="border-input hover:bg-accent rounded-md border px-3 py-2 text-sm font-medium"
          >
            Locations
          </Link>
          <Link
            href="/assets/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          >
            + Register New Asset
          </Link>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-card border-border flex flex-col items-center justify-between gap-4 rounded-lg border p-4 md:flex-row">
        <form onSubmit={handleSearchSubmit} className="flex w-full flex-1 gap-2 md:w-auto">
          <input
            type="text"
            placeholder="Search by ref, name, tag, serial number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-input bg-background w-full max-w-md rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-4 py-2 text-sm font-medium"
          >
            Search
          </button>
        </form>

        <div className="flex w-full items-center gap-2 md:w-auto">
          <label
            htmlFor="state-filter"
            className="text-muted-foreground whitespace-nowrap text-sm font-medium"
          >
            Lifecycle State:
          </label>
          <select
            id="state-filter"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All States</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_REPAIR">In Repair</option>
            <option value="RETIRED">Retired</option>
            <option value="DISPOSED">Disposed</option>
            <option value="LOST">Lost</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Asset Table */}
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        {loading ? (
          <div className="text-muted-foreground p-8 text-center">Loading asset inventory...</div>
        ) : assets.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center">
            No assets found matching the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Asset Ref</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Assignment</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/50 transition-colors">
                    <td className="text-primary px-4 py-3 font-mono text-xs font-bold">
                      <Link href={`/assets/${asset.id}`} className="hover:underline">
                        {asset.assetRef}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/assets/${asset.id}`} className="hover:underline">
                        {asset.name}
                      </Link>
                      {asset.assetTag && (
                        <span className="text-muted-foreground block text-xs">
                          Tag: {asset.assetTag}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {asset.assetType?.name ?? "-"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {asset.category?.name ?? "-"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {asset.location?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getLifecycleColor(
                          asset.lifecycleState,
                        )}`}
                      >
                        {asset.lifecycleState}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {asset.assignedUser?.email
                        ? `User: ${asset.assignedUser.email}`
                        : asset.assignedDepartment
                          ? `Dept: ${asset.assignedDepartment}`
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        View & Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
