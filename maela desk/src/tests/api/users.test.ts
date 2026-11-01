import { describe, expect, it } from "vitest";
import { metaApi } from "@/lib/api/client";
import { bodyOf, installFetchMock, jsonResponse, method } from "../helpers/api";

const sampleUser = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Dawit Haile",
  email: "agent@meladesk.test",
  role: "AGENT",
  teamId: "t1",
  teamName: "Service Desk",
  createdAt: new Date().toISOString(),
  active: true,
};

describe("metaApi — user administration", () => {
  it("users lists the paged user directory", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/users?page=1&pageSize=10");
      return jsonResponse({ items: [sampleUser], total: 1, page: 1, pageSize: 10 });
    });

    const result = await metaApi.users({ page: 1, pageSize: 10 });
    expect(result.items[0].email).toBe("agent@meladesk.test");
  });

  it("setUserActive patches /users/:id/status", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe(`/api/users/${sampleUser.id}/status`);
      expect(method([url, init])).toBe("PATCH");
      return jsonResponse({ user: { ...sampleUser, active: false } });
    });

    await metaApi.setUserActive(sampleUser.id, false);
    expect(bodyOf(fetchMock.mock.calls[0] as unknown as [string, RequestInit])).toEqual({ active: false });
  });

  it("setUserRole patches /users/:id/role", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe(`/api/users/${sampleUser.id}/role`);
      expect(method([url, init])).toBe("PATCH");
      return jsonResponse({ user: { ...sampleUser, role: "TEAM_LEAD" } });
    });

    await metaApi.setUserRole(sampleUser.id, "TEAM_LEAD");
    expect(bodyOf(fetchMock.mock.calls[0] as unknown as [string, RequestInit])).toEqual({ role: "TEAM_LEAD" });
  });

  it("updateUser patches the profile", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe(`/api/users/${sampleUser.id}`);
      expect(method([url, init])).toBe("PATCH");
      return jsonResponse({ user: { ...sampleUser, name: "Dawit H." } });
    });

    await metaApi.updateUser(sampleUser.id, { name: "Dawit H." });
    expect(bodyOf(fetchMock.mock.calls[0] as unknown as [string, RequestInit])).toEqual({ name: "Dawit H." });
  });

  it("createUser posts a new account", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/users");
      expect(method([url, init])).toBe("POST");
      return jsonResponse({ user: sampleUser }, 201);
    });

    await metaApi.createUser({ name: "Dawit Haile", email: "agent@meladesk.test", password: "Str0ng!", role: "AGENT" });
  });
});

describe("metaApi — teams", () => {
  it("teams lists teams", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/teams");
      return jsonResponse({
        items: [{ id: "t1", name: "Service Desk", departmentId: null, active: true }],
        total: 1,
      });
    });

    const result = await metaApi.teams();
    expect(result.items[0].name).toBe("Service Desk");
  });

  it("createTeam posts the new team", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/teams");
      expect(method([url, init])).toBe("POST");
      return jsonResponse({ team: { id: "t2", name: "Network Ops", active: true } }, 201);
    });

    await metaApi.createTeam({ name: "Network Ops" });
  });

  it("addTeamMember posts to /teams/:id/members", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/teams/t1/members");
      expect(method([url, init])).toBe("POST");
      return jsonResponse({ member: { userId: sampleUser.id } }, 201);
    });

    await metaApi.addTeamMember("t1", { userId: sampleUser.id });
    expect(bodyOf(fetchMock.mock.calls[0] as unknown as [string, RequestInit])).toEqual({ userId: sampleUser.id });
  });

  it("removeTeamMember deletes /teams/:id/members/:userId", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe(`/api/teams/t1/members/${sampleUser.id}`);
      expect(method([url, init])).toBe("DELETE");
      return jsonResponse(undefined, 204);
    });

    await metaApi.removeTeamMember("t1", sampleUser.id);
  });
});
