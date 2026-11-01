import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(env.SESSION_SECRET).digest();
}

export function encryptSecret(value: string): { algorithm: "aes-256-gcm"; iv: string; tag: string; value: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    value: ciphertext.toString("base64url"),
  };
}

export function decryptSecret(value: { algorithm: string; iv: string; tag: string; value: string }): string {
  if (value.algorithm !== "aes-256-gcm") throw new Error("Unsupported encrypted payload.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.value, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
