import { describe, expect, it } from "vitest";
import { ApiError, authApi } from "@/lib/api/client";
import { CSRF_TOKEN, bodyOf, installFetchMock, jsonResponse, method } from "../helpers/api";

const sampleUser = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Admin User",
  email: "admin@meladesk.test",
  role: "ADMIN",
  teamId: null,
  teamName: null,
  preferredLanguage: "en",
  timeZone: "Africa/Addis_Ababa",
  createdAt: new Date().toISOString(),
  active: true,
};

describe("authApi (real-mode client)", () => {
  it("login posts credentials with CSRF token and returns the user", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/auth/login");
      expect(method([url, init])).toBe("POST");
      return jsonResponse({ user: sampleUser });
    });

    const { user } = await authApi.login("admin@meladesk.test", "Password123!");
    expect(user.email).toBe("admin@meladesk.test");
    expect(user.role).toBe("ADMIN");
  });

  it("login sends the CSRF header on mutating requests", async () => {
    const fetchMock = installFetchMock(() => jsonResponse({ user: sampleUser }));
    await authApi.login("admin@meladesk.test", "Password123!");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe(CSRF_TOKEN);
    expect(init.credentials).toBe("include");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "admin@meladesk.test",
      password: "Password123!",
    });
  });

  it("register posts name, email and password", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/auth/register");
      expect(JSON.parse(String(init.body))).toEqual({
        name: "New User",
        email: "new@meladesk.test",
        password: "Str0ngPass!",
      });
      return jsonResponse({ user: { ...sampleUser, role: "REQUESTER", id: "u9" } }, 201);
    });

    const { user } = await authApi.register({ name: "New User", email: "new@meladesk.test", password: "Str0ngPass!" });
    expect(user.role).toBe("REQUESTER");
  });

  it("me fetches the current user", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/auth/me");
      return jsonResponse({ user: sampleUser });
    });

    const { user } = await authApi.me();
    expect(user.id).toBe(sampleUser.id);
  });

  it("logout returns undefined for a 204 response", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/auth/logout");
      expect(method([url, init])).toBe("POST");
      return jsonResponse(undefined, 204);
    });

    expect(await authApi.logout()).toBeUndefined();
  });

  it("forgotPassword returns an accepted envelope", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/auth/forgot-password");
      expect(JSON.parse(String(init.body))).toEqual({ email: "who@meladesk.test" });
      return jsonResponse({ accepted: true }, 202);
    });

    expect(await authApi.forgotPassword("who@meladesk.test")).toEqual({ accepted: true });
  });

  it("resetPassword posts the token plus new password", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/auth/reset-password");
      expect(JSON.parse(String(init.body))).toEqual({ token: "tok-1", password: "NewPass123!" });
      return jsonResponse(undefined, 204);
    });

    await authApi.resetPassword("tok-1", "NewPass123!");
  });

  it("changePassword posts both passwords", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/auth/change-password");
      expect(JSON.parse(String(init.body))).toEqual({ currentPassword: "Old1!", newPassword: "New1!" });
      return jsonResponse(undefined, 204);
    });

    await authApi.changePassword("Old1!", "New1!");
  });

  it("maps 401 responses to UNAUTHENTICATED ApiError", async () => {
    installFetchMock(() => jsonResponse({ success: false }, 401));
    await expect(authApi.me()).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });

  it("maps 403 responses to FORBIDDEN ApiError", async () => {
    installFetchMock(() => jsonResponse({}, 403));
    const error = await authApi.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("FORBIDDEN");
    expect((error as ApiError).status).toBe(403);
  });

  it("maps 404 responses to NOT_FOUND ApiError", async () => {
    installFetchMock(() => jsonResponse({}, 404));
    await expect(authApi.me()).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("maps 422 responses to VALIDATION ApiError and serializes details", async () => {
    installFetchMock(() => jsonResponse({ error: { code: "VALIDATION" } }, 422));
    await expect(authApi.me()).rejects.toMatchObject({ status: 422, code: "VALIDATION" });
  });

  it("maps 500 responses to SERVER error", async () => {
    installFetchMock(() => jsonResponse({ ok: false }));
    const fail = installFetchMock(() => jsonResponse({}, 500));
    void fail;
    await expect(authApi.me()).rejects.toMatchObject({ code: "SERVER" });
  });

  it("maps network failures to a NETWORK ApiError", async () => {
    installFetchMock(() => {
      throw new TypeError("fetch failed");
    });
    await expect(authApi.me()).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("body is sent as JSON string with matching content type", async () => {
    const fetchMock = installFetchMock(() => jsonResponse({ accepted: true }, 202));
    await authApi.forgotPassword("x@y.test");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(typeof init.body).toBe("string");
    expect(bodyOf(fetchMock.mock.calls[0] as [string, RequestInit])).toEqual({ email: "x@y.test" });
  });
});
