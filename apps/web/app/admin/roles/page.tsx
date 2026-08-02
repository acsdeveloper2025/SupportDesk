"use client";

import { useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface RoleItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

interface MatrixItem {
  permissionKey: string;
  description: string;
  roleGrants: Record<string, boolean>;
}

export default function RolesAdminPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [matrix, setMatrix] = useState<MatrixItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/permissions/matrix")
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{ roles: RoleItem[]; matrix: MatrixItem[] }>)
          : { roles: [], matrix: [] },
      )
      .then((data) => {
        if (isMounted) {
          setRoles(data.roles ?? []);
          setMatrix(data.matrix ?? []);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Roles & Permission Matrix
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Platform roles definitions and matrix permission evaluation engine
          </p>
        </div>

        {/* Roles List */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {roles.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-white">{r.name}</span>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {r.key}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {r.description ?? "Standard role configuration"}
              </p>
            </div>
          ))}
        </div>

        {/* Permission Matrix Grid */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Permission Key</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                {roles.map((r) => (
                  <th key={r.key} className="px-3 py-3 text-center font-semibold">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={roles.length + 2} className="px-4 py-6 text-center text-gray-500">
                    Loading permission matrix...
                  </td>
                </tr>
              ) : (
                matrix.slice(0, 30).map((m) => (
                  <tr key={m.permissionKey} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {m.permissionKey}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{m.description}</td>
                    {roles.map((r) => (
                      <td key={r.key} className="px-3 py-2 text-center font-bold">
                        {m.roleGrants[r.key] ? (
                          <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-700">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
