import { z } from "zod";

const uuid = z.string().uuid();
export const teamIdParams = z.object({ id: uuid }).strict();
export const teamUserParams = z.object({ id: uuid, userId: uuid }).strict();
export const teamQuery = z.object({ departmentId: uuid.optional(), active: z.enum(["true", "false"]).optional(), q: z.string().trim().max(120).optional() }).strict();
export const teamCreateSchema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), departmentId: uuid.nullable().optional(), active: z.boolean().default(true) }).strict();
export const teamUpdateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(500).nullable().optional(), departmentId: uuid.nullable().optional(), active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated." });
export const teamMemberSchema = z.object({ userId: uuid, membershipRole: z.string().trim().min(1).max(32).default("MEMBER") }).strict();
