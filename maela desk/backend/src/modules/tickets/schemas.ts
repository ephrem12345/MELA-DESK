import { z } from "zod";

const ticketStatus = z.enum(["OPEN", "IN_PROGRESS", "PENDING_REQUESTER", "PENDING_THIRD_PARTY", "RESOLVED", "CLOSED"]);
const priorityCode = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
const uuid = z.string().uuid();

export const ticketIdParams = z.object({ id: uuid }).strict();
export const commentIdParams = z.object({ id: uuid }).strict();

export const ticketListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: ticketStatus.optional(),
  priority: priorityCode.optional(),
  categoryId: uuid.optional(),
  teamId: z.string().trim().min(1).max(120).optional(),
  assignedAgentId: uuid.optional(),
  requesterId: uuid.optional(),
  departmentId: uuid.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sla: z.enum(["ON_TRACK", "AT_RISK", "BREACHED", "COMPLETED", "NOT_APPLICABLE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["createdAt", "updatedAt", "priority"]).default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
}).strict().refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "dateFrom must be before or equal to dateTo",
  path: ["dateFrom"],
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(10).max(240),
  description: z.string().trim().min(20).max(20000),
  categoryId: uuid,
  priority: priorityCode.default("NORMAL"),
  service: z.string().trim().max(120).optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  attachmentIds: z.array(uuid).max(10).default([]),
}).strict();

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(10).max(240).optional(),
  description: z.string().trim().min(20).max(20000).optional(),
  categoryId: uuid.optional(),
  service: z.string().trim().max(120).nullable().optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().optional(),
  version: z.coerce.number().int().min(1).optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== "version"), { message: "At least one field must be updated." });

export const assignTicketSchema = z.object({
  agentId: z.union([uuid, z.literal("")]).optional(),
  teamId: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const statusSchema = z.object({
  status: ticketStatus,
  reason: z.string().trim().max(500).optional(),
  version: z.coerce.number().int().min(1).optional(),
}).strict();

export const prioritySchema = z.object({
  priority: priorityCode,
  reason: z.string().trim().max(500).optional(),
  version: z.coerce.number().int().min(1).optional(),
}).strict();

export const resolveSchema = z.object({
  summary: z.string().trim().min(1).max(5000),
  code: z.string().trim().min(1).max(80),
  rootCause: z.string().trim().max(5000).optional(),
  correctiveAction: z.string().trim().max(5000).optional(),
  preventiveAction: z.string().trim().max(5000).optional(),
  publicExplanation: z.string().trim().max(5000).optional(),
  version: z.coerce.number().int().min(1).optional(),
}).strict();

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(20000),
  attachmentIds: z.array(uuid).max(10).default([]),
}).strict();

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(20000),
}).strict();

export const reportRangeQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  departmentId: uuid.optional(),
  teamId: uuid.optional(),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "from must be before or equal to to",
  path: ["from"],
});
