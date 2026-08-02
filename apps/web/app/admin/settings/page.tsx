"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminHeaderNav } from "../components/AdminHeaderNav";

interface FlagItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
}

export default function SettingsAdminPage() {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(() => {
    setLoading(true);
    void fetch("/api/admin/feature-flags")
      .then((r) => (r.ok ? (r.json() as Promise<FlagItem[]>) : []))
      .then((data) => {
        setFlags(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/admin/feature-flags")
      .then((r) => (r.ok ? (r.json() as Promise<FlagItem[]>) : []))
      .then((data) => {
        if (isMounted) setFlags(data);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleFlag = async (flag: FlagItem) => {
    await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: flag.id,
        key: flag.key,
        name: flag.name,
        description: flag.description,
        isEnabled: !flag.isEnabled,
      }),
    });
    fetchFlags();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminHeaderNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Global Settings & Feature Flags
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Platform parameters, maintenance mode windows, and dynamic feature flag toggles
          </p>
        </div>

        {/* Feature Flags Section */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Feature Flag Controls
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Toggle dynamic capabilities across platform and tenant boundaries
          </p>

          <div className="mt-4 space-y-4">
            {loading ? (
              <p className="text-xs text-gray-500">Loading feature flags...</p>
            ) : flags.length === 0 ? (
              <p className="text-xs text-gray-500">No feature flags registered.</p>
            ) : (
              flags.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50"
                >
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">{flag.name}</span>
                    <span className="ml-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                      ({flag.key})
                    </span>
                    <p className="text-xs text-gray-500">{flag.description}</p>
                  </div>

                  <button
                    onClick={() => {
                      void handleToggleFlag(flag);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold text-white transition ${
                      flag.isEnabled
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-gray-400 hover:bg-gray-500 dark:bg-gray-700"
                    }`}
                  >
                    {flag.isEnabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
