"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UserIdentity {
  userId: string;
  email: string;
  tenantId: string;
  roles?: string[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (isMounted) {
            setAuthenticated(false);
            setLoading(false);
            router.push("/login?redirectTo=/admin");
          }
          return;
        }

        const user = (await res.json()) as UserIdentity;
        if (isMounted) {
          if (user && user.userId) {
            setAuthenticated(true);
          } else {
            setAuthenticated(false);
            router.push("/login?redirectTo=/admin");
          }
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setAuthenticated(false);
          setLoading(false);
          router.push("/login?redirectTo=/admin");
        }
      }
    }

    void checkAdminAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Verifying administrative session...
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
