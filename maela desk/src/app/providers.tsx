"use client";

import { ToastProvider } from "@/components/ui";
import { LocaleProvider } from "@/lib/i18n/provider";
import { SessionProvider } from "@/lib/session";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ToastProvider>
        <SessionProvider>{children}</SessionProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
