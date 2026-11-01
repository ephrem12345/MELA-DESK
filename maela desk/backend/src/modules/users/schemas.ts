import { z } from "zod";

const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const uuid = z.string().uuid();

export const usersQuery = z.object({
  q: z.string().trim().max(160).optional(),
  role: z.enum(["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"]).optional(),
  active: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const userIdParams = z.object({ id: uuid }).strict();

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email,
  password: z.string().min(8).max(128),
  role: z.enum(["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"]).default("REQUESTER"),
  departmentId: uuid.nullable().optional(),
  teamId: uuid.nullable().optional(),
  preferredLanguage: z.enum(["en", "am"]).default("en"),
}).strict();

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  email: email.optional(),
  preferredLanguage: z.enum(["en", "am"]).optional(),
  timeZone: z.string().trim().min(1).max(80).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, { message: "A valid IANA time zone is required." }).optional(),
  departmentId: uuid.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated." });

export const updateUserStatusSchema = z.object({ active: z.boolean() }).strict();
export const updateUserRoleSchema = z.object({ role: z.enum(["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"]) }).strict();
export const addTeamMemberSchema = z.object({ userId: uuid, membershipRole: z.string().trim().min(1).max(32).default("MEMBER") }).strict();

