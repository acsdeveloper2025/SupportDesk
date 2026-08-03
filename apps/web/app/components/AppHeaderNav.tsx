"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "./LogoutButton";

const portalNavItems = [
  { href: "/tickets", label: "Tickets" },
  { href: "/kb", label: "Knowledge Base" },
  { href: "/assets", label: "CMDB Assets" },
  { href: "/reports", label: "Reports & Analytics" },
  { href: "/profile", label: "Profile Settings" },
];

export function AppHeaderNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3">
          <Link href="/tickets" className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow">
              SD
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">SupportDesk</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Enterprise Service Portal</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin"
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Admin Console →
          </Link>
          <LogoutButton />
        </div>
      </div>

      <nav className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {portalNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/tickets" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
