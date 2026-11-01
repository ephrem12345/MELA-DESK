import { z } from "zod";

const emailSchema = z.string().trim().email().max(320).transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  password: passwordSchema,
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
}).strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(256),
  password: passwordSchema,
}).strict();
