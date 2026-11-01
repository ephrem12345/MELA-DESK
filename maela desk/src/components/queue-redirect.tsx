"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

/**
 * Queues share the main ticket list component with a preset filter applied to
 * the URL. This keeps a single data-fetch path and shareable URLs.
 */
export function QueueRedirect({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    let q = query;
    // Personal queues resolve the current user server-side via session.
    q = q.replace("{me}", user.id);
    router.replace(`${pathname}?${q}`);
  }, [query, router, pathname, user]);

  return null;
}
