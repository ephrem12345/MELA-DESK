import type {
  AuditLogEntry,
  Category,
  DashboardStats,
  NotificationItem,
  Paginated,
  RegisterInput,
  Ticket,
  TicketDetail,
  TicketFilters,
  User,
} from "./types";
import {
  addMockAttachment,
  addMockTicketMessage,
  assignMockTicket,
  createMockTicket,
  escalateMockTicket,
  getCurrentMockUser,
  getMockAuditLogs,
  getMockCategories,
  getMockDashboardStats,
  getMockNotifications,
  getMockTicketDetail,
  getMockTeams,
  getMockUsers,
  listMockTickets,
  markAllMockNotificationsRead,
  markMockNotificationRead,
  reopenMockTicket,
  resolveMockTicket,
  updateMockTicketPriority,
  updateMockTicketStatus,
} from "./mock-service";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const isMockMode = () =>
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" &&
  process.env.NODE_ENV !== "production";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
let csrfToken: string | null = null;
let csrfPending: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPending ??= (async () => {
    const response = await fetch(`${API_URL}/auth/csrf`, { credentials: "include" });
    if (!response.ok) throw new ApiError(response.status, "CSRF_UNAVAILABLE", "network");
    const body = await response.json() as { token?: string };
    if (!body.token) throw new ApiError(0, "CSRF_UNAVAILABLE", "network");
    csrfToken = body.token;
    return body.token;
  })().finally(() => { csrfPending = null; });
  return csrfPending;
}

/**
 * Centralized typed API client. Throws ApiError on non-2xx responses.
 * When mock mode is active, calls are served by src/lib/api/mock.ts and the UI
 * labels them as development data.
 */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal; idempotencyKey?: string } = {}
): Promise<T> {
  const { method = "GET", body, signal, idempotencyKey } = options;
  let res: Response;
  try {
    const headers = new Headers();
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers.set("X-CSRF-Token", await getCsrfToken());
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      credentials: "include",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK", "network");
  }
  if (res.status === 401) throw new ApiError(401, "UNAUTHENTICATED", "unauthorized");
  if (res.status === 403) throw new ApiError(403, "FORBIDDEN", "unauthorized");
  if (res.status === 404) throw new ApiError(404, "NOT_FOUND", "notFound");
  if (res.status === 409) {
    const data = await res.json().catch(() => null);
    throw new ApiError(409, data?.error?.code ?? "CONFLICT", data?.error?.message ?? "An account with this email address already exists.");
  }
  if (res.status === 422) {
    const data = await res.json().catch(() => null);
    throw new ApiError(422, "VALIDATION", JSON.stringify(data ?? {}));
  }
  if (!res.ok) throw new ApiError(res.status, "SERVER", "generic");
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function withQuery(path: string, params: object): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

// --- Auth ---
export const authApi = {
  me: () => apiRequest<{ user: User }>("/auth/me"),
  login: (email: string, password: string) =>
    apiRequest<{ user: User }>("/auth/login", { method: "POST", body: { email, password } }),
  register: (input: RegisterInput) =>
    apiRequest<{ user: User }>("/auth/register", { method: "POST", body: input }),
  forgotPassword: (email: string) =>
    apiRequest<{ accepted: boolean }>("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token: string, password: string) =>
    apiRequest<void>("/auth/reset-password", { method: "POST", body: { token, password } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<void>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
};

// --- Tickets ---
export const ticketApi = {
  create: async (payload: Record<string, unknown>) => {
    if (isMockMode()) return { ticket: createMockTicket(payload) };
    return apiRequest<{ ticket: Ticket }>("/tickets", { method: "POST", body: payload, idempotencyKey: crypto.randomUUID() });
  },
  list: async (filters: TicketFilters, signal?: AbortSignal) => {
    if (isMockMode()) {
      if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
      return listMockTickets(filters);
    }
    return apiRequest<Paginated<Ticket>>(withQuery("/tickets", filters), { signal });
  },
  detail: async (id: string, signal?: AbortSignal) => {
    if (isMockMode()) {
      if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
      const ticket = getMockTicketDetail(id);
      if (!ticket) throw new ApiError(404, "NOT_FOUND", "notFound");
      return ticket;
    }
    return apiRequest<TicketDetail>(`/tickets/${id}`, { signal });
  },
  updateStatus: async (id: string, status: string) => {
    if (isMockMode()) return { ticket: updateMockTicketStatus(id, status) };
    return apiRequest<{ ticket: Ticket }>(`/tickets/${id}/status`, { method: "POST", body: { status } });
  },
  updatePriority: async (id: string, priority: string) => {
    if (isMockMode()) return { ticket: updateMockTicketPriority(id, priority) };
    return apiRequest<{ ticket: Ticket }>(`/tickets/${id}/priority`, { method: "POST", body: { priority } });
  },
  assign: async (id: string, payload: { agentId?: string; teamId?: string }) => {
    if (isMockMode()) return { ticket: assignMockTicket(id, payload) };
    return apiRequest<{ ticket: Ticket }>(`/tickets/${id}/assign`, { method: "POST", body: payload });
  },
  escalate: async (id: string) => {
    if (isMockMode()) return { ticket: escalateMockTicket(id) };
    return apiRequest<{ ticket: Ticket }>(`/tickets/${id}/escalate`, { method: "POST" });
  },
  reply: async (id: string, body: string, attachmentIds: string[]) => {
    if (isMockMode()) return { message: addMockTicketMessage(id, body, attachmentIds) };
    return apiRequest<{ message: { id: string } }>(`/tickets/${id}/replies`, {
      method: "POST",
      body: { body, attachmentIds },
      idempotencyKey: crypto.randomUUID(),
    });
  },
  internalNote: async (id: string, body: string, attachmentIds: string[]) => {
    if (isMockMode()) return { message: addMockTicketMessage(id, body, attachmentIds, true) };
    return apiRequest<{ message: { id: string } }>(`/tickets/${id}/notes`, {
      method: "POST",
      body: { body, attachmentIds },
      idempotencyKey: crypto.randomUUID(),
    });
  },
  resolve: async (id: string, payload: Record<string, string>) => {
    if (isMockMode()) return { ticket: resolveMockTicket(id, payload) };
    return apiRequest<{ ticket: Ticket }>(`/tickets/${id}/resolve`, { method: "POST", body: payload });
  },
  reopen: async (id: string) => {
    if (isMockMode()) return { ticket: reopenMockTicket(id) };
    return apiRequest<{ ticket: Ticket }>(`/tickets/${id}/reopen`, { method: "POST" });
  },
};

export const attachmentApi = {
  downloadUrl: (ticketId: string, attachmentId: string) => `${API_URL}/attachments/${ticketId}/${attachmentId}`,
  upload: async (file: File, onProgress?: (pct: number) => void): Promise<{ id: string }> => {
    if (isMockMode()) {
      onProgress?.(50);
      await new Promise((r) => setTimeout(r, 300));
      const id = `att-${file.name}-${Date.now()}`;
      addMockAttachment(id, file);
      onProgress?.(100);
      return { id };
    }
    const form = new FormData();
    form.append("file", file);
    const csrf = await getCsrfToken();
    const res = await fetch(`${API_URL}/attachments`, {
      method: "POST",
      body: form,
      credentials: "include",
      headers: { "X-CSRF-Token": csrf },
    });
    if (!res.ok) throw new ApiError(res.status, res.status === 401 ? "UNAUTHENTICATED" : "SERVER", "uploadFailed");
    onProgress?.(100);
    return (await res.json()) as { id: string };
  },
};

// --- Dashboard / meta ---
export const metaApi = {
  dashboardStats: async () => isMockMode() ? getMockDashboardStats(getCurrentMockUser().role) : apiRequest<DashboardStats>("/dashboard/stats"),
  categories: async () => isMockMode() ? getMockCategories() : apiRequest<Category[]>("/categories"),
  notifications: async (signal?: AbortSignal) => {
    if (isMockMode()) {
      if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
      return getMockNotifications();
    }
    return apiRequest<{ items: NotificationItem[]; total: number }>("/notifications", { signal });
  },
  markNotificationRead: async (id: string) => {
    if (isMockMode()) return markMockNotificationRead(id);
    return apiRequest<void>(`/notifications/${id}/read`, { method: "POST" });
  },
  markAllNotificationsRead: async () => {
    if (isMockMode()) return markAllMockNotificationsRead();
    return apiRequest<void>("/notifications/read-all", { method: "POST" });
  },
  auditLogs: async (params: Record<string, unknown>) => isMockMode() ? getMockAuditLogs(params) : apiRequest<Paginated<AuditLogEntry>>(withQuery("/audit-logs", params)),
  users: async (params: Record<string, unknown>) => isMockMode() ? getMockUsers(params) : apiRequest<Paginated<User>>(withQuery("/users", params)),
  teams: async (params: Record<string, unknown> = {}) => isMockMode() ? getMockTeams(params) : apiRequest<Paginated<{ id: string; name: string; departmentId?: string | null; active: boolean }>>(withQuery("/teams", params)),
  createUser: (payload: Record<string, unknown>) => apiRequest<{ user: User }>("/users", { method: "POST", body: payload }),
  updateUser: (id: string, payload: Record<string, unknown>) => apiRequest<{ user: User }>(`/users/${id}`, { method: "PATCH", body: payload }),
  setUserActive: (id: string, active: boolean) => apiRequest<{ user: User }>(`/users/${id}/status`, { method: "PATCH", body: { active } }),
  setUserRole: (id: string, role: string) => apiRequest<{ user: User }>(`/users/${id}/role`, { method: "PATCH", body: { role } }),
  createTeam: (payload: Record<string, unknown>) => apiRequest<{ team: { id: string; name: string; active: boolean } }>("/teams", { method: "POST", body: payload }),
  updateTeam: (id: string, payload: Record<string, unknown>) => apiRequest<{ team: { id: string; name: string; active: boolean } }>(`/teams/${id}`, { method: "PATCH", body: payload }),
  addTeamMember: (id: string, payload: { userId: string; membershipRole?: string }) => apiRequest(`/teams/${id}/members`, { method: "POST", body: payload }),
  removeTeamMember: (id: string, userId: string) => apiRequest<void>(`/teams/${id}/members/${userId}`, { method: "DELETE" }),
  createCategory: (payload: Record<string, unknown>) => apiRequest<{ category: Category }>("/categories", { method: "POST", body: payload }),
  updateCategory: (id: string, payload: Record<string, unknown>) => apiRequest<{ category: Category }>(`/categories/${id}`, { method: "PATCH", body: payload }),
  createPriority: (payload: Record<string, unknown>) => apiRequest("/priorities", { method: "POST", body: payload }),
  updatePriority: (id: string, payload: Record<string, unknown>) => apiRequest(`/priorities/${id}`, { method: "PATCH", body: payload }),
  slaPolicies: () => apiRequest<{ items: { id: string; priorityId: string; priority: string; firstResponseMinutes: number; resolutionMinutes: number; warningMinutes: number; active: boolean }[] }>("/sla"),
  updateSlaPolicy: (id: string, payload: Record<string, unknown>) => apiRequest(`/sla/${id}`, { method: "PATCH", body: payload }),
  settings: () => apiRequest<{ items: { key: string; value: unknown; updatedAt: string }[] }>("/settings"),
  updateSettings: (settings: Record<string, unknown>) => apiRequest<{ updated: string[] }>("/settings", { method: "PATCH", body: { settings } }),
  workflow: () => apiRequest<{ initialStatus: string; transitions: Record<string, string[]> }>("/workflows"),
  updateWorkflow: (transitions: Record<string, string[]>) => apiRequest<{ initialStatus: string; transitions: Record<string, string[]> }>("/workflows", { method: "PATCH", body: { transitions } }),
};

export const reportsApi = {
  summary: (params: Record<string, unknown>) =>
    apiRequest<{
      volume: { date: string; total: number }[];
      byStatus: { label: string; total: number }[];
      byPriority: { label: string; total: number }[];
      byCategory: { label: string; total: number }[];
      avgFirstResponseMinutes: number | null;
      avgResolutionMinutes: number | null;
      slaCompliancePct: number | null;
      reopenRatePct: number | null;
      agentWorkload: { name: string; total: number }[];
    }>(withQuery("/reports/summary", params)),
};
