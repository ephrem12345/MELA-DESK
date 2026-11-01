import { z } from "zod";

const uuid = z.string().uuid();
export const catalogIdParams = z.object({ id: uuid }).strict();
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  labelEn: z.string().trim().min(2).max(160),
  labelAm: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  parentId: uuid.nullable().optional(),
  active: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
}).strict();
export const categoryUpdateSchema = categoryCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated." });
export const priorityCreateSchema = z.object({
  code: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  name: z.string().trim().min(2).max(40),
  level: z.coerce.number().int().min(1).max(4),
  firstResponseMinutes: z.coerce.number().int().min(1).max(525600),
  resolutionMinutes: z.coerce.number().int().min(1).max(525600),
  active: z.boolean().default(true),
}).strict();
export const priorityUpdateSchema = priorityCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated." });
