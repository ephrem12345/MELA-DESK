import { describe, expect, it } from "vitest";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schemas.js";

describe("auth request validation", () => {
  it("normalizes registration and login emails", () => {
    expect(registerSchema.parse({ name: "Sam User", email: "SAM@example.test", password: "long-password-123" }).email).toBe("sam@example.test");
    expect(loginSchema.parse({ email: "SAM@example.test", password: "x" }).email).toBe("sam@example.test");
  });

  it("rejects weak passwords and extra protected fields", () => {
    expect(registerSchema.safeParse({ name: "Sam User", email: "sam@example.test", password: "short", role: "ADMIN" }).success).toBe(false);
  });

  it("validates password reset and change payloads", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "new-password-123" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "too-short", password: "new-password-123" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
