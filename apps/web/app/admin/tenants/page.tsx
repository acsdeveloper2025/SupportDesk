"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  state: string;
  plan: string;
  createdAt: string;
}

interface TenantListResponse {
  tenants: TenantItem[];
  total: number;
}

export default function TenantAdminPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");

  const fetchTenants = useCallback((q = "") => {
    setLoading(true);
    void fetch(`/api/admin/tenants?search=${q}`)
      .then((res) =>
        res.ok ? (res.json() as Promise<TenantListResponse>) : { tenants: [], total: 0 },
      )
      .then((data) => {
        setTenants(data.tenants ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/tenants?search=")
      .then((res) =>
        res.ok ? (res.json() as Promise<TenantListResponse>) : { tenants: [], total: 0 },
      )
      .then((data) => {
        if (isMounted) {
          setTenants(data.tenants ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants(search);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const trimmedName = newTenantName.trim();
    const trimmedSlug = newTenantSlug.trim();
    if (!trimmedName || !trimmedSlug) return;
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setCreateError("Tenant slug must contain only lowercase letters, digits, and dashes.");
      return;
    }
    const res = await fetchWithCsrf("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        slug: trimmedSlug,
        adminEmail: "admin@" + trimmedSlug + ".com",
        adminName: "Tenant Admin",
      }),
    });
    if (res.ok) {
      setShowModal(false);
      setNewTenantName("");
      setNewTenantSlug("");
      fetchTenants();
    } else {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setCreateError(body?.message ?? `Failed to create tenant: HTTP ${res.status}`);
    }
  };

  const handleStateChange = async (
    tenantId: string,
    action: "activate" | "deactivate" | "suspend",
  ) => {
    await fetchWithCsrf(`/api/admin/tenants/${tenantId}/${action}`, { method: "POST" });
    fetchTenants(search);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Tenant Administration
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Provision customer workspaces, manage quotas, and transition lifecycle states ({total}{" "}
              Total)
            </p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
            }}
            className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 sm:mt-0"
          >
            + Provision New Tenant
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6 flex space-x-2">
          <input
            type="text"
            placeholder="Search by tenant name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Search
          </button>
        </form>

        {/* Tenant Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Tenant Name</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Created At</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Loading tenants...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No tenants found.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-semibold">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400">
                      {t.slug}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          t.state === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : t.state === "SUSPENDED"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {t.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{t.plan}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="space-x-1 px-4 py-3 text-right">
                      {t.state !== "ACTIVE" && (
                        <button
                          onClick={() => {
                            void handleStateChange(t.id, "activate");
                          }}
                          className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                        >
                          Activate
                        </button>
                      )}
                      {t.state !== "SUSPENDED" && (
                        <button
                          onClick={() => {
                            void handleStateChange(t.id, "suspend");
                          }}
                          className="rounded bg-amber-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-500"
                        >
                          Suspend
                        </button>
                      )}
                      {t.state !== "DEACTIVATED" && (
                        <button
                          onClick={() => {
                            void handleStateChange(t.id, "deactivate");
                          }}
                          className="rounded bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-500"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Provision Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Provision New Tenant
              </h3>
              {createError && (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  {createError}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  void handleCreateTenant(e);
                }}
                className="mt-4 space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Tenant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Tenant Slug
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[a-z0-9-]+"
                    title="Use only lowercase letters, digits, and dashes."
                    value={newTenantSlug}
                    onChange={(e) =>
                      setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="acme-corp"
                  />
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
