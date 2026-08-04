"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      const csrfRes = await fetch("/api/auth/csrf", { method: "GET" });
      const csrfData = (await csrfRes.json()) as { csrfToken?: string };

      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfData.csrfToken ?? "",
        },
      });

      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    } catch {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loggingOut}
      className={
        className ??
        "inline-flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-red-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-red-400"
      }
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
