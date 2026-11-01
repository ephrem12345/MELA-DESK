import Link from "next/link";
import { Headphones, LayoutDashboard, MessageSquareText, ShieldCheck, Ticket, Workflow } from "lucide-react";
import { MockBanner } from "@/components/status-badges";

const features = [
  {
    icon: <Ticket className="size-5" />,
    title: "Submit support tickets",
    body: "Create categorized, prioritized requests with attachments.",
  },
  {
    icon: <MessageSquareText className="size-5" />,
    title: "Talk with your agent",
    body: "Public replies, status history, and resolution details.",
  },
  {
    icon: <Workflow className="size-5" />,
    title: "Organized workflows",
    body: "Agents use investigation workspaces and internal notes.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Role-aware access",
    body: "Requester, agent, team lead, and admin experiences.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MockBanner />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold tracking-tight text-blue-700">
          MELA<span className="text-slate-800"> DESK</span>
        </span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100">
            Sign in
          </Link>
          <Link href="/register" className="rounded-md bg-blue-600 px-3.5 py-2 font-medium text-white hover:bg-blue-700">
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <section className="grid items-center gap-10 py-12 md:grid-cols-2">
          <div>
            <p className="mb-2 inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Headphones aria-hidden className="size-3.5" /> Support Desk &amp; Ticket Management
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              The support desk that keeps every request moving.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              MELA DESK helps teams submit, track, and resolve support requests with clear
              status, SLA indicators, and bilingual English / Amharic support.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in to your workspace
              </Link>
              <Link
                href="/register"
                className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Register as requester
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-800">
              <LayoutDashboard aria-hidden className="text-blue-600" /> What you can do
            </div>
            <ul className="space-y-4">
              {features.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="mt-0.5 text-blue-600">{f.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{f.title}</p>
                    <p className="text-xs text-slate-500">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
