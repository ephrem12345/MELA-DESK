import { z } from "zod";

const uuid = z.string().uuid();
export const departmentIdParams = z.object({ id: uuid }).strict();
export const departmentQuery = z.object({ active: z.enum(["true", "false"]).optional(), q: z.string().trim().max(120).optional() }).strict();
export const departmentCreateSchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/), description: z.string().trim().max(500).optional(), active: z.boolean().default(true) }).strict();
export const departmentUpdateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), code: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(), description: z.string().trim().max(500).nullable().optional(), active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated." });
