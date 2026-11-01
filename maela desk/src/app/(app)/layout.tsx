"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Skeleton, TableSkeleton } from "@/components/ui";
import { isAreaAllowed, areaForPathname } from "@/lib/permissions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  const area = areaForPathname(pathname);
  const allowed = !user || isAreaAllowed(user.role, pathname);

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.replace("/access-denied");
    }
  }, [loading, user, allowed, router]);

  if (loading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-6 h-10 w-64" />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }
  if (!user) return null;

  if (!allowed) {
    router.replace("/access-denied");
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
