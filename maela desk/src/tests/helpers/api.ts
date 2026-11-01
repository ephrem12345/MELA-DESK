import { vi } from "vitest";

/** CSRF token the mocked bootstrap endpoint always returns. */
export const CSRF_TOKEN = "tests-csrf-token";
export const API_URL = "/api";

export function jsonResponse(body: unknown, status = 200): Response {
  const response = new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "content-type": "application/json" },
  });
  // Response.ok is read-only getter; shadow it per instance.
  return Object.assign(response, { ok: status < 400 });
}

export function csrfResponse(): Response {
  return jsonResponse({ token: CSRF_TOKEN }, 200);
}

/** Handler receives the raw URL string and the RequestInit. */
export type SimpleHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

/**
 * Stub the global fetch. The /auth/csrf bootstrap is always handled automatically
 * (client.ts caches a CSRF token for the whole test run, so every mocking test path
 * goes through it). Any other unmatched URL fails the test loudly.
 */
export function installFetchMock(handler?: SimpleHandler) {
  const fetchMock = vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (!handler) throw new Error(`Unexpected fetch in test: ${init.method ?? "GET"} ${url}`);
    return await handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export type FetchCalls = [url: string, init: RequestInit][];

export function method(call: [string, RequestInit]): string {
  return (call[1].method ?? "GET").toUpperCase();
}

export function bodyOf(call: [string, RequestInit]): unknown {
  const raw = call[1].body;
  if (typeof raw !== "string") return raw;
  return JSON.parse(raw);
}

export function headersOf(call: [string, RequestInit]): Headers {
  const raw = call[1].headers;
  return new Headers(raw);
}
