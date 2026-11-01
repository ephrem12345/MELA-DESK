/**
 * DEVELOPMENT-ONLY mock data. Clearly labeled: the mock mode is controlled by
 * NEXT_PUBLIC_USE_MOCKS and must NEVER be enabled in production. The UI shows a
 * banner while mocks are active. When a real backend is available, set
 * NEXT_PUBLIC_USE_MOCKS=false and the typed client talks to the real API.
 */
import type {
  AuditLogEntry,
  Category,
  DashboardStats,
  NotificationItem,
  Paginated,
  Role,
  Ticket,
  TicketDetail,
  TicketFilters,
  TicketMessage,
  User,
} from "./types";

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60000).toISOString();

const cat = (
  id: string,
  name: string,
  en: string,
  am: string,
  order = 0,
  parentId: string | null = null
): Category => ({
  id,
  name,
  labelEn: en,
  labelAm: am,
  parentId,
  active: true,
  displayOrder: order,
});

export const mockCategories: Category[] = [
  cat("cat-1", "hardware", "Hardware", "ሃርድዌር", 1),
  cat("cat-2", "software", "Software", "ሶፍትዌር", 2),
  cat("cat-3", "network", "Network & connectivity", "ኔትወርክ", 3),
  cat("cat-4", "account-access", "Account & access", "መለያ ተደራሽነት", 4),
  cat("cat-5", "email", "Email issues", "የኢሜይል ችግሮች", 1, "cat-2"),
];

const users: User[] = [
  { id: "u-1", name: "Sara Bekele", email: "requester@meladesk.test", role: "REQUESTER", teamId: null, teamName: null, createdAt: iso(400000), active: true },
  { id: "u-2", name: "Dawit Haile", email: "agent@meladesk.test", role: "AGENT", teamId: "t-1", teamName: "Service Desk", createdAt: iso(400000), active: true },
  { id: "u-3", name: "Hanna Girma", email: "lead@meladesk.test", role: "TEAM_LEAD", teamId: "t-1", teamName: "Service Desk", createdAt: iso(400000), active: true },
  { id: "u-4", name: "Admin User", email: "admin@meladesk.test", role: "ADMIN", teamId: null, teamName: null, createdAt: iso(400000), active: true },
  { id: "u-5", name: "Michael Tesfaye", email: "agent2@meladesk.test", role: "AGENT", teamId: "t-1", teamName: "Service Desk", createdAt: iso(300000), active: true },
];

export const mockUsers = users;

export const mockTeams = [
  { id: "t-1", name: "Service Desk", lead: "Hanna Girma", openTickets: 12, active: true },
  { id: "t-2", name: "Network Operations", lead: "Unassigned", openTickets: 5, active: true },
];

const passwordOk = "Password123!";

export interface MockCredentials {
  email: string;
  role: Role;
  password: string;
}

const credentials: MockCredentials[] = [
  { email: "requester@meladesk.test", role: "REQUESTER", password: passwordOk },
  { email: "agent@meladesk.test", role: "AGENT", password: passwordOk },
  { email: "lead@meladesk.test", role: "TEAM_LEAD", password: passwordOk },
  { email: "admin@meladesk.test", role: "ADMIN", password: passwordOk },
];

const baseTicket = (
  i: number,
  overrides: Partial<Ticket> & { subject: string }
): Ticket => {
  const statuses = ["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "RESOLVED", "URGENT"] as const;
  const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
  const status = overrides.status ?? (statuses[i % statuses.length] as string === "URGENT" ? "OPEN" : (statuses[i % statuses.length] as Ticket["status"]));
  const priority = overrides.priority ?? (priorities[i % priorities.length] as Ticket["priority"]);
  return {
    id: `tk-${i}`,
    ticketNumber: `MD-${1000 + i}`,
    // subject comes from overrides spread below
    description:
      "Steps: opened the application and used the main workflow.\nExpected: the transaction completes.\nActual: an error dialog appears after 30 seconds.",
    status,
    priority,
    category: mockCategories[i % mockCategories.length],
    requester: { id: "u-1", name: "Sara Bekele", email: "requester@meladesk.test" },
    assignedTeam: i % 3 === 0 ? null : "Service Desk",
    assignedAgent: i % 3 === 0 ? null : i % 2 === 0 ? { id: "u-2", name: "Dawit Haile" } : { id: "u-5", name: "Michael Tesfaye" },
    slaDueAt: status === "RESOLVED" || status === "CLOSED" ? null : new Date(now + (i % 4 === 0 ? -3600000 : (i % 4) * 7200000)).toISOString(),
    slaIndicator:
      status === "RESOLVED"
        ? "COMPLETED"
        : status === "CLOSED"
          ? "NOT_APPLICABLE"
          : i % 4 === 0
            ? "BREACHED"
            : i % 3 === 0
              ? "AT_RISK"
              : "ON_TRACK",
    createdAt: iso(6000 - i * 40),
    updatedAt: iso(200 - i * 5),
    attachmentCount: i % 3 === 0 ? 1 : 0,
    ...overrides,
  };
};

const ticketSubjects = [
  "Cannot print to office printer",
  "Email inbox not syncing on mobile",
  "Password reset request",
  "VPN connection drops every hour",
  "CRM dashboard loads slowly",
  "Request new employee laptop",
  "Expense portal shows error E-402",
  "Shared drive permission missing",
  "Two-factor authentication fails",
  "Zoom audio not working in meetings",
  "Wireless mouse unresponsive",
  "Access to finance reports denied",
];

export const mockTickets: Ticket[] = Array.from({ length: 14 }, (_, i) =>
  baseTicket(i, { subject: ticketSubjects[i % ticketSubjects.length] })
);

export function buildMockTicketDetail(id: string, role: Role): TicketDetail | null {
  const t = mockTickets.find((x) => x.id === id);
  if (!t) return null;
  const publicMessages: TicketMessage[] = [
    {
      id: "m-1",
      authorId: t.requester.id,
      authorName: t.requester.name,
      authorRole: "REQUESTER",
      body: `${t.description}\n\nAdditional context: this started after the last update.`,
      isInternal: false,
      createdAt: t.createdAt,
      attachments: [],
    },
  ];
  if (t.assignedAgent) {
    publicMessages.push({
      id: "m-2",
      authorId: t.assignedAgent.id,
      authorName: t.assignedAgent.name,
      authorRole: "AGENT",
      body: "Thank you for the report. I have started investigating and will update you shortly.",
      isInternal: false,
      createdAt: t.updatedAt,
      attachments: [],
    });
  }
  const staffOnly: TicketMessage[] =
    role === "REQUESTER"
      ? []
      : [
          {
            id: "m-3",
            authorId: "u-2",
            authorName: "Dawit Haile",
            authorRole: "AGENT",
            body: "Internal: reproduced on staging with build 4.2.1. Suspected regression in the sync worker. Escalating to platform team if next build fails.",
            isInternal: true,
            createdAt: t.updatedAt,
            attachments: [],
          },
        ];
  return {
    ...t,
    requesterEmail: t.requester.email,
    messages: [...publicMessages, ...staffOnly].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    history: [
      { id: "h-1", field: "status", fromValue: null, toValue: t.status, actorName: t.assignedAgent?.name ?? "System", createdAt: t.updatedAt },
      { id: "h-2", field: "assignee", fromValue: null, toValue: t.assignedAgent?.name ?? null, actorName: "Hanna Girma", createdAt: t.updatedAt },
    ],
    attachments: t.attachmentCount
      ? [{ id: "a-1", fileName: "error-screenshot.png", fileSize: 184320, mimeType: "image/png", createdAt: t.createdAt }]
      : [],
    resolution:
      t.status === "RESOLVED"
        ? {
            summary: "Rebuilt the sync cache and reset the mobile session.",
            code: "R-CACHE-01",
            rootCause: "Stale sync cache after app update.",
            correctiveAction: "Cleared cache and reauthenticated the device.",
            preventiveAction: "Patch scheduled in release 4.2.2.",
            publicExplanation: "The issue was a temporary sync fault. It has been fixed on your device.",
            resolvedAt: t.updatedAt,
          }
        : null,
    relatedTicketNumbers: [mockTickets[(Number(t.id.replace("tk-", "")) + 3) % mockTickets.length].ticketNumber],
  };
}

export function filterMockTickets(filters: TicketFilters): Paginated<Ticket> {
  let items = [...mockTickets];
  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (t) => t.ticketNumber.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
  }
  if (filters.status) items = items.filter((t) => t.status === filters.status);
  if (filters.priority) items = items.filter((t) => t.priority === filters.priority);
  if (filters.categoryId) items = items.filter((t) => t.category.id === filters.categoryId);
  if (filters.assignedAgentId) items = items.filter((t) => t.assignedAgent?.id === filters.assignedAgentId);
  if (filters.sla) items = items.filter((t) => t.slaIndicator === filters.sla);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const total = items.length;
  items = items.slice((page - 1) * pageSize, page * pageSize);
  return { items, total, page, pageSize };
}

export function mockDashboardStats(role: Role): DashboardStats {
  const mine = role === "REQUESTER" ? mockTickets : mockTickets.slice(0, 9);
  const c = (fn: (t: Ticket) => boolean) => mine.filter(fn).length;
  return {
    total: mine.length,
    open: c((t) => t.status === "OPEN"),
    inProgress: c((t) => t.status === "IN_PROGRESS"),
    pending: c((t) => t.status.startsWith("PENDING")),
    resolved: c((t) => t.status === "RESOLVED" || t.status === "CLOSED"),
    urgent: c((t) => t.priority === "URGENT"),
  };
}

export function mockNotifications(role: Role): NotificationItem[] {
  void role;
  return [
    { id: "n-1", title: "Agent replied to your ticket", message: "Dawit Haile: Thank you for the report…", ticketId: "tk-0", ticketNumber: "MD-1000", read: false, category: "reply", createdAt: iso(12) },
    { id: "n-2", title: "Ticket assigned to you", message: "MD-1004 was assigned to you by Hanna Girma.", ticketId: "tk-4", ticketNumber: "MD-1004", read: false, category: "assignment", createdAt: iso(90) },
    { id: "n-3", title: "SLA at risk", message: "MD-1007 is approaching its resolution deadline.", ticketId: "tk-7", ticketNumber: "MD-1007", read: true, category: "sla", createdAt: iso(300) },
  ];
}

export function mockAuditLogs(): AuditLogEntry[] {
  return [
    { id: "al-1", timestamp: iso(30), actor: "admin@meladesk.test", action: "user.updated", resourceType: "User", resourceId: "u-5", changes: "role: AGENT→TEAM_LEAD", correlationId: "corr-9f2" },
    { id: "al-2", timestamp: iso(240), actor: "lead@meladesk.test", action: "ticket.resolved", resourceType: "Ticket", resourceId: "MD-1003", changes: "status: IN_PROGRESS→RESOLVED", correlationId: "corr-7a1" },
  ];
}

export function verifyMockCredentials(email: string, password: string): User | null {
  const cred = credentials.find((c) => c.email.toLowerCase() === email.toLowerCase());
  if (!cred || cred.password !== password) return null;
  return users.find((u) => u.email === cred.email) ?? null;
}
