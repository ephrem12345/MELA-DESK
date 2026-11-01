export type Role = "REQUESTER" | "AGENT" | "TEAM_LEAD" | "ADMIN";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_REQUESTER"
  | "PENDING_THIRD_PARTY"
  | "RESOLVED"
  | "CLOSED";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type SlaIndicator = "ON_TRACK" | "AT_RISK" | "BREACHED" | "COMPLETED" | "NOT_APPLICABLE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId?: string | null;
  teamName?: string | null;
  timeZone?: string;
  createdAt: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  labelEn: string;
  labelAm: string;
  description?: string | null;
  parentId?: string | null;
  active: boolean;
  displayOrder: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  isInternal: boolean;
  createdAt: string;
  attachments: Attachment[];
}

export interface TicketHistoryEntry {
  id: string;
  field: string;
  fromValue: string | null;
  toValue: string | null;
  actorName: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  category: Category;
  requester: { id: string; name: string; email: string };
  assignedTeam?: string | null;
  assignedAgent?: { id: string; name: string } | null;
  slaDueAt: string | null;
  slaIndicator: SlaIndicator;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
}

export interface TicketDetail extends Ticket {
  requesterEmail: string;
  messages: TicketMessage[];
  history: TicketHistoryEntry[];
  attachments: Attachment[];
  resolution: {
    summary: string | null;
    code: string | null;
    rootCause: string | null;
    correctiveAction: string | null;
    preventiveAction: string | null;
    publicExplanation: string | null;
    resolvedAt: string | null;
  } | null;
  relatedTicketNumbers: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketFilters {
  q?: string;
  status?: TicketStatus;
  priority?: Priority;
  categoryId?: string;
  teamId?: string;
  assignedAgentId?: string;
  dateFrom?: string;
  dateTo?: string;
  sla?: SlaIndicator;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "updatedAt" | "priority";
  sortDir?: "asc" | "desc";
}

export interface DashboardStats {
  total: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  urgent: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  ticketId?: string | null;
  ticketNumber?: string | null;
  read: boolean;
  category: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: string | null;
  correlationId?: string | null;
}

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};
