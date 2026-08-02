"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface UserItem {
  id: string;
  emailNormalized: string;
  state: string;
  profile?: { fullName?: string };
  userRoles?: { role: { key: string; name: string } }[];
}

interface UserListResponse {
  users: UserItem[];
  total: number;
}

export default function UserAdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");

  const fetchUsers = useCallback((q = "") => {
    setLoading(true);
    void fetch(`/api/admin/users?search=${q}`)
      .then((res) => (res.ok ? (res.json() as Promise<UserListResponse>) : { users: [], total: 0 }))
      .then((data) => {
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/users?search=")
      .then((res) => (res.ok ? (res.json() as Promise<UserListResponse>) : { users: [], total: 0 }))
      .then((data) => {
        if (isMounted) {
          setUsers(data.users ?? []);
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        fullName: inviteName,
        roleKeys: [inviteRole],
      }),
    });
    if (res.ok) {
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteName("");
      fetchUsers();
    }
  };

  const handleToggleLock = async (userId: string, isCurrentlyLocked: boolean) => {
    const action = isCurrentlyLocked ? "unlock" : "lock";
    await fetch(`/api/admin/users/${userId}/${action}`, { method: "POST" });
    fetchUsers(search);
  };

  const handleForceLogout = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}/force-logout`, { method: "POST" });
    alert("User active sessions revoked successfully.");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Administration</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage accounts, invitations, active sessions, and force logout controls ({total}{" "}
              Total)
            </p>
          </div>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 sm:mt-0"
          >
            + Invite New User
          </button>
        </div>

        {/* User Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-semibold">User Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Assigned Roles</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-900 dark:divide-gray-800 dark:text-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-semibold">
                      {u.profile?.fullName ?? "Unnamed User"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {u.emailNormalized}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.state === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {u.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.userRoles?.map((ur) => (
                          <span
                            key={ur.role.key}
                            className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          >
                            {ur.role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="space-x-1 px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          void handleToggleLock(u.id, false);
                        }}
                        className="rounded bg-amber-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-500"
                      >
                        Lock/Unlock
                      </button>
                      <button
                        onClick={() => {
                          void handleForceLogout(u.id);
                        }}
                        className="rounded bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-500"
                      >
                        Force Logout
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Invite Modal */}
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Invite User</h3>
              <form
                onSubmit={(e) => {
                  void handleInvite(e);
                }}
                className="mt-4 space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Initial Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="tenant_admin">Tenant Admin</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Send Invitation
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
