"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  FolderTree,
  Gauge,
  Globe,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  ShieldCheck,
  Ticket as TicketIcon,
  Users,
  Workflow,
  UserCircle2,
  X,
  BarChart3,
  HardDrive,
  History,
  HeartPulse,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/lib/i18n/provider";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/api/types";
import { MockBanner } from "@/components/status-badges";
import { metaApi } from "@/lib/api/client";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

function navFor(role: Role, localT: (k: string) => string): { group: string; items: NavItem[] }[] {
  const groups: Record<Role, { group: string; items: NavItem[] }[]> = {
    REQUESTER: [
      { group: localT("nav.main"), items: [
        { href: "/dashboard", labelKey: "nav.dashboard", icon: <LayoutDashboard className="size-4" /> },
      ]},
      { group: localT("nav.support"), items: [
        { href: "/tickets", labelKey: "nav.tickets", icon: <TicketIcon className="size-4" /> },
        { href: "/tickets/new", labelKey: "nav.newTicket", icon: <PlusCircle className="size-4" /> },
        { href: "/notifications", labelKey: "nav.notifications", icon: <Bell className="size-4" /> },
      ]},
    ],
    AGENT: [
      { group: localT("nav.agentArea"), items: [
        { href: "/agent/dashboard", labelKey: "nav.agentDashboard", icon: <Gauge className="size-4" /> },
        { href: "/agent/assigned", labelKey: "nav.assigned", icon: <ClipboardList className="size-4" /> },
        { href: "/agent/queue", labelKey: "nav.queue", icon: <ListChecks className="size-4" /> },
        { href: "/agent/escalated", labelKey: "nav.escalated", icon: <ShieldCheck className="size-4" /> },
        { href: "/agent/team", labelKey: "nav.agentTeam", icon: <Users className="size-4" /> },
      ]},
      { group: localT("nav.support"), items: [
        { href: "/tickets", labelKey: "nav.tickets", icon: <TicketIcon className="size-4" /> },
      ]},
    ],
    TEAM_LEAD: [
      { group: localT("nav.teamLeadArea"), items: [
        { href: "/team/dashboard", labelKey: "nav.teamDashboard", icon: <Gauge className="size-4" /> },
        { href: "/team/queue", labelKey: "nav.queue", icon: <ListChecks className="size-4" /> },
        { href: "/team/agents", labelKey: "nav.agents", icon: <Users className="size-4" /> },
        { href: "/team/reports", labelKey: "nav.reports", icon: <BarChart3 className="size-4" /> },
      ]},
      { group: localT("nav.agentArea"), items: [
        { href: "/agent/assigned", labelKey: "nav.assigned", icon: <ClipboardList className="size-4" /> },
      ]},
    ],
    ADMIN: [
      { group: localT("nav.adminArea"), items: [
        { href: "/admin", labelKey: "nav.dashboard", icon: <Gauge className="size-4" /> },
        { href: "/admin/users", labelKey: "nav.users", icon: <Users className="size-4" /> },
        { href: "/admin/roles", labelKey: "nav.roles", icon: <ShieldCheck className="size-4" /> },
        { href: "/admin/teams", labelKey: "nav.teams", icon: <Users className="size-4" /> },
        { href: "/admin/categories", labelKey: "nav.categories", icon: <FolderTree className="size-4" /> },
        { href: "/admin/workflows", labelKey: "nav.workflows", icon: <Workflow className="size-4" /> },
        { href: "/admin/sla", labelKey: "nav.sla", icon: <Globe className="size-4" /> },
        { href: "/admin/notifications", labelKey: "nav.adminNotifications", icon: <Bell className="size-4" /> },
        { href: "/admin/localization", labelKey: "nav.localization", icon: <Languages className="size-4" /> },
        { href: "/admin/reports", labelKey: "nav.reports", icon: <BarChart3 className="size-4" /> },
        { href: "/admin/audit-logs", labelKey: "nav.auditLogs", icon: <History className="size-4" /> },
        { href: "/admin/storage", labelKey: "nav.storage", icon: <HardDrive className="size-4" /> },
        { href: "/admin/system-health", labelKey: "nav.systemHealth", icon: <HeartPulse className="size-4" /> },
      ]},
      { group: localT("nav.support"), items: [
        { href: "/tickets", labelKey: "nav.tickets", icon: <TicketIcon className="size-4" /> },
      ]},
    ],
  };
  void localT;
  return groups[role];
}

const allowedBase = (href: string, role: Role): boolean => {
  const segment = href.split("/")[1] ?? "";
  const area = segment === "" ? "dashboard" : segment;
  const allowedByRole: Record<Role, string[]> = {
    REQUESTER: ["dashboard", "tickets", "notifications", "profile", "settings"],
    AGENT: ["agent", "tickets", "notifications", "profile", "settings", "dashboard"],
    TEAM_LEAD: ["team", "agent", "tickets", "notifications", "profile", "settings"],
    ADMIN: ["admin", "tickets", "notifications", "profile", "settings"],
  };
  return allowedByRole[role]?.includes(area) ?? false;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? "REQUESTER";
  const groups = useMemo(() => navFor(role, (k) => t(k)), [role, t]);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { items } = await metaApi.notifications();
        if (alive) setUnread(items.filter((n) => !n.read).length);
      } catch {
        /* notification count is best-effort */
      }
    };
    void load();
    const id = setInterval(load, 30000); // polling fallback documented in README
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <Link href="/" className="text-base font-bold tracking-tight text-blue-700">
          MELA<span className="text-slate-800"> DESK</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={t("nav.main")}>
        {groups.map((g) => (
          <div key={g.group} className="mb-3">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>
            <ul>
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                if (!allowedBase(item.href, role)) return null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm",
                        active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {item.icon}
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white">
            <button
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded p-1 text-slate-400"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <MockBanner />
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-4">
          <button
            className="rounded p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          <form
            className="ml-auto flex max-w-xs flex-1"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q") as string;
              router.push(`/tickets?q=${encodeURIComponent(q ?? "")}`);
            }}
          >
            <input
              name="q"
              type="search"
              placeholder={t("common.search")}
              aria-label={t("common.search")}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:bg-white"
            />
          </form>

          {/* Language switcher */}
          <div aria-label="Language" className="ml-1 flex overflow-hidden rounded-md border border-slate-200 text-xs">
            {(["en", "am"] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                aria-pressed={locale === l}
                className={cn("px-2.5 py-1.5", locale === l ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
              >
                {l === "en" ? "EN" : "አማ"}
              </button>
            ))}
          </div>

          {/* Notifications */}
          <div className="relative ml-1" ref={bellRef}>
            <button
              className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t("nav.notifications")}
              aria-expanded={bellOpen}
              onClick={() => setBellOpen((v) => !v)}
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 z-50 mt-1 w-80 animate-fade-in rounded-lg border border-slate-200 bg-white shadow-lg">
                <Link
                  href="/notifications"
                  className="block border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500 hover:text-blue-600"
                  onClick={() => setBellOpen(false)}
                >
                  {t("notifications.title")} ({unread} {t("notifications.unread")})
                </Link>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative ml-1 flex items-center gap-1">
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <UserCircle2 aria-hidden className="size-5" />
              <span className="font-medium text-slate-700">{user?.name}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5">{t(`roles.${role.toLowerCase()}`)}</span>
            </span>
            <button aria-label={t("common.signOut")} onClick={handleSignOut} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        <main id="main" className="flex-1 p-4 lg:p-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 px-4 py-3 text-center text-[11px] text-slate-400">
          MELA DESK — {t("common.appTagline")}
        </footer>
      </div>
    </div>
  );
}
