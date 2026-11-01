import type {
  Attachment,
  AuditLogEntry,
  Category,
  DashboardStats,
  NotificationItem,
  Paginated,
  Priority,
  Role,
  Ticket,
  TicketDetail,
  TicketFilters,
  TicketMessage,
  TicketStatus,
  User,
} from "./types";
import {
  buildMockTicketDetail,
  mockAuditLogs,
  mockCategories,
  mockNotifications,
  mockTickets,
  mockTeams,
  mockUsers,
} from "./mock";

const STORE_KEY = "mela-desk.mock-store.v1";

interface MockStore {
  tickets: TicketDetail[];
  notifications: NotificationItem[];
  attachments: Attachment[];
}

let memoryStore: MockStore | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedStore(): MockStore {
  return {
    tickets: mockTickets.flatMap((ticket) => {
      const detail = buildMockTicketDetail(ticket.id, "AGENT");
      return detail ? [detail] : [];
    }),
    notifications: mockNotifications("REQUESTER"),
    attachments: [],
  };
}

function getStore(): MockStore {
  if (memoryStore) return memoryStore;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MockStore>;
        if (Array.isArray(parsed.tickets) && Array.isArray(parsed.notifications)) {
          memoryStore = {
            tickets: parsed.tickets,
            notifications: parsed.notifications,
            attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
          };
          return memoryStore;
        }
      }
    } catch {
      // Ignore invalid or unavailable browser storage and use fresh demo data.
    }
  }

  memoryStore = createSeedStore();
  return memoryStore;
}

function saveStore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(getStore()));
  } catch {
    // The in-memory demo remains usable when browser storage is unavailable.
  }
}

export function getCurrentMockUser(): User {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("mela-mock-user");
      if (raw) {
        const user = JSON.parse(raw) as User;
        if (user?.id && user?.name && user?.role) return user;
      }
    } catch {
      // Fall through to the default requester account.
    }
  }
  return mockUsers[0];
}

function toTicket(detail: TicketDetail): Ticket {
  const {
    requesterEmail: _requesterEmail,
    messages: _messages,
    history: _history,
    attachments: _attachments,
    resolution: _resolution,
    relatedTicketNumbers: _relatedTicketNumbers,
    ...ticket
  } = detail;
  return ticket;
}

function requireTicket(id: string): TicketDetail {
  const ticket = getStore().tickets.find((item) => item.id === id);
  if (!ticket) throw new Error("notFound");
  return ticket;
}

function appendHistory(ticket: TicketDetail, field: string, fromValue: string | null, toValue: string | null): void {
  const actor = getCurrentMockUser();
  const createdAt = new Date().toISOString();
  ticket.updatedAt = createdAt;
  ticket.history.push({
    id: makeId("history"),
    field,
    fromValue,
    toValue,
    actorName: actor.name,
    createdAt,
  });
}

function addNotification(notification: Omit<NotificationItem, "id" | "read" | "createdAt">): void {
  getStore().notifications.unshift({
    ...notification,
    id: makeId("notification"),
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function pageOf<T>(items: T[], params: Record<string, unknown>): Paginated<T> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 10));
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export function getMockTicketDetail(id: string, role: Role = getCurrentMockUser().role): TicketDetail | null {
  const stored = getStore().tickets.find((ticket) => ticket.id === id);
  if (!stored) return null;
  const detail = clone(stored);
  if (role === "REQUESTER") detail.messages = detail.messages.filter((message) => !message.isInternal);
  return detail;
}

export function listMockTickets(filters: TicketFilters = {}): Paginated<Ticket> {
  let items = getStore().tickets.map(toTicket);
  if (filters.q) {
    const query = filters.q.toLowerCase();
    items = items.filter((ticket) =>
      ticket.ticketNumber.toLowerCase().includes(query) ||
      ticket.subject.toLowerCase().includes(query) ||
      ticket.requester.name.toLowerCase().includes(query)
    );
  }
  if (filters.status) items = items.filter((ticket) => ticket.status === filters.status);
  if (filters.priority) items = items.filter((ticket) => ticket.priority === filters.priority);
  if (filters.categoryId) items = items.filter((ticket) => ticket.category.id === filters.categoryId);
  if (filters.teamId) items = items.filter((ticket) => ticket.assignedTeam === filters.teamId || (filters.teamId === "t-1" && ticket.assignedTeam === "Service Desk"));
  if (filters.assignedAgentId) items = items.filter((ticket) => ticket.assignedAgent?.id === filters.assignedAgentId);
  if (filters.sla) items = items.filter((ticket) => ticket.slaIndicator === filters.sla);
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    if (Number.isFinite(from)) items = items.filter((ticket) => new Date(ticket.createdAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime() + 86400000;
    if (Number.isFinite(to)) items = items.filter((ticket) => new Date(ticket.createdAt).getTime() < to);
  }

  const direction = filters.sortDir === "asc" ? 1 : -1;
  if (filters.sort === "priority") {
    const rank: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };
    items.sort((a, b) => (rank[a.priority] - rank[b.priority]) * direction);
  } else if (filters.sort === "createdAt") {
    items.sort((a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction);
  } else {
    items.sort((a, b) => (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 10));
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export function createMockTicket(payload: Record<string, unknown>): Ticket {
  const store = getStore();
  const user = getCurrentMockUser();
  const now = new Date().toISOString();
  const subject = String(payload.subject ?? "Untitled support request");
  const description = String(payload.description ?? "");
  const categoryId = String(payload.categoryId ?? "");
  const category = mockCategories.find((item) => item.id === categoryId) ?? mockCategories[0];
  const priorities: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
  const requestedPriority = String(payload.priority ?? "NORMAL") as Priority;
  const priority = priorities.includes(requestedPriority) ? requestedPriority : "NORMAL";
  const ticketNumber = `MD-${Math.max(999, ...store.tickets.map((item) => Number(item.ticketNumber.replace(/^MD-/, "")) || 0)) + 1}`;
  const id = makeId("ticket");
  const attachmentIds = Array.isArray(payload.attachmentIds) ? payload.attachmentIds.map(String) : [];
  const attachments = attachmentIds.flatMap((attachmentId) => {
    const attachment = store.attachments.find((item) => item.id === attachmentId);
    return attachment ? [clone(attachment)] : [];
  });
  const ticket: TicketDetail = {
    id,
    ticketNumber,
    subject,
    description,
    status: "OPEN",
    priority,
    category,
    requester: { id: user.id, name: user.name, email: user.email },
    requesterEmail: user.email,
    assignedTeam: null,
    assignedAgent: null,
    slaDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    slaIndicator: "ON_TRACK",
    createdAt: now,
    updatedAt: now,
    attachmentCount: attachments.length,
    messages: [{
      id: makeId("message"),
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      body: description,
      isInternal: false,
      createdAt: now,
      attachments,
    }],
    history: [{ id: makeId("history"), field: "status", fromValue: null, toValue: "OPEN", actorName: user.name, createdAt: now }],
    attachments,
    resolution: null,
    relatedTicketNumbers: [],
  };
  store.tickets.unshift(ticket);
  addNotification({
    title: "Support request created",
    message: `${ticket.ticketNumber} was created successfully.`,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    category: "status",
  });
  saveStore();
  return toTicket(ticket);
}

export function addMockTicketMessage(id: string, body: string, attachmentIds: string[], internal = false): { id: string } {
  const ticket = requireTicket(id);
  const user = getCurrentMockUser();
  const createdAt = new Date().toISOString();
  const message: TicketMessage = {
    id: makeId("message"),
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    body,
    isInternal: internal,
    createdAt,
    attachments: attachmentIds.flatMap((attachmentId) => {
      const attachment = getStore().attachments.find((item) => item.id === attachmentId);
      return attachment ? [clone(attachment)] : [];
    }),
  };
  ticket.messages.push(message);
  appendHistory(ticket, internal ? "internal_note" : "reply", null, "Added");
  if (!internal) {
    addNotification({
      title: "New ticket reply",
      message: `${user.name}: ${body}`,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: "reply",
    });
  }
  saveStore();
  return { id: message.id };
}

export function updateMockTicketStatus(id: string, status: string): Ticket {
  const ticket = requireTicket(id);
  const next = status as TicketStatus;
  const allowed: TicketStatus[] = ["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"];
  if (!allowed.includes(next)) throw new Error("invalidStatus");
  const previous = ticket.status;
  ticket.status = next;
  if (next === "RESOLVED") ticket.slaIndicator = "COMPLETED";
  else if (next === "CLOSED") ticket.slaIndicator = "NOT_APPLICABLE";
  else if (previous === "RESOLVED" || previous === "CLOSED") ticket.slaIndicator = "ON_TRACK";
  appendHistory(ticket, "status", previous, next);
  saveStore();
  return toTicket(ticket);
}

export function updateMockTicketPriority(id: string, priority: string): Ticket {
  const ticket = requireTicket(id);
  const allowed: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
  if (!allowed.includes(priority as Priority)) throw new Error("invalidPriority");
  const previous = ticket.priority;
  ticket.priority = priority as Priority;
  appendHistory(ticket, "priority", previous, ticket.priority);
  saveStore();
  return toTicket(ticket);
}

export function assignMockTicket(id: string, assignment: { agentId?: string; teamId?: string }): Ticket {
  const ticket = requireTicket(id);
  const previous = ticket.assignedAgent?.name ?? ticket.assignedTeam ?? null;
  const team = assignment.teamId;
  ticket.assignedTeam = team
    ? team === "t-1" ? "Service Desk" : team === "t-2" ? "Network Operations" : team
    : null;
  const agent = assignment.agentId ? mockUsers.find((user) => user.id === assignment.agentId) : null;
  ticket.assignedAgent = agent ? { id: agent.id, name: agent.name } : null;
  appendHistory(ticket, "assignee", previous, ticket.assignedAgent?.name ?? ticket.assignedTeam ?? null);
  saveStore();
  return toTicket(ticket);
}

export function escalateMockTicket(id: string): Ticket {
  return updateMockTicketPriority(id, "URGENT");
}

export function resolveMockTicket(id: string, data: Record<string, string>): Ticket {
  const ticket = requireTicket(id);
  const previous = ticket.status;
  const now = new Date().toISOString();
  ticket.status = "RESOLVED";
  ticket.slaIndicator = "COMPLETED";
  ticket.resolution = {
    summary: data.summary || null,
    code: data.code || null,
    rootCause: data.rootCause || null,
    correctiveAction: data.correctiveAction || null,
    preventiveAction: data.preventiveAction || null,
    publicExplanation: data.publicExplanation || data.summary || null,
    resolvedAt: now,
  };
  appendHistory(ticket, "status", previous, "RESOLVED");
  saveStore();
  return toTicket(ticket);
}

export function reopenMockTicket(id: string): Ticket {
  const ticket = requireTicket(id);
  const previous = ticket.status;
  ticket.status = "OPEN";
  ticket.slaIndicator = "ON_TRACK";
  ticket.resolution = null;
  appendHistory(ticket, "status", previous, "OPEN");
  saveStore();
  return toTicket(ticket);
}

export function getMockDashboardStats(_role: Role = getCurrentMockUser().role): DashboardStats {
  const tickets = getStore().tickets.map(toTicket);
  const count = (predicate: (ticket: Ticket) => boolean) => tickets.filter(predicate).length;
  return {
    total: tickets.length,
    open: count((ticket) => ticket.status === "OPEN"),
    inProgress: count((ticket) => ticket.status === "IN_PROGRESS"),
    pending: count((ticket) => ticket.status === "PENDING_REQUESTER" || ticket.status === "PENDING_THIRD_PARTY"),
    resolved: count((ticket) => ticket.status === "RESOLVED" || ticket.status === "CLOSED"),
    urgent: count((ticket) => ticket.priority === "URGENT"),
  };
}

export function getMockNotifications(): { items: NotificationItem[]; total: number } {
  const items = clone(getStore().notifications).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, total: items.length };
}

export function markMockNotificationRead(id: string): void {
  const notification = getStore().notifications.find((item) => item.id === id);
  if (notification) notification.read = true;
  saveStore();
}

export function markAllMockNotificationsRead(): void {
  getStore().notifications.forEach((item) => { item.read = true; });
  saveStore();
}

export function addMockAttachment(id: string, file: Pick<File, "name" | "size" | "type">): void {
  const attachment: Attachment = {
    id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
  };
  getStore().attachments = [...getStore().attachments.filter((item) => item.id !== id), attachment];
  saveStore();
}

export function getMockCategories(): Category[] {
  return clone(mockCategories);
}

export function getMockUsers(params: Record<string, unknown>): Paginated<User> {
  const current = getCurrentMockUser();
  let users = [...mockUsers];
  if (!users.some((user) => user.id === current.id)) users = [current, ...users];
  if (typeof params.role === "string") users = users.filter((user) => user.role === params.role);
  if (typeof params.active === "string") users = users.filter((user) => user.active === (params.active === "true"));
  const query = String(params.q ?? "").trim().toLowerCase();
  if (query) users = users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query));
  return pageOf(users, params);
}

export function getMockTeams(params: Record<string, unknown>) {
  const query = String(params.q ?? "").trim().toLowerCase();
  const items = mockTeams.filter((team) => !query || team.name.toLowerCase().includes(query));
  return pageOf(items, params);
}

export function getMockAuditLogs(params: Record<string, unknown>): Paginated<AuditLogEntry> {
  return pageOf(mockAuditLogs(), params);
}
