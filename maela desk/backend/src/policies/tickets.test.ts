import { describe, expect, it } from "vitest";
import { AppError } from "../errors/app-error.js";
import { assertStatusTransition, canAssignTicket, canViewTicket, visibleCommentWhere } from "./tickets.js";
import type { AuthenticatedUser } from "../types/express.js";

const requester: AuthenticatedUser = { id: "requester", name: "Requester", email: "r@example.test", role: "REQUESTER", departmentId: null, teamIds: [], locale: "en" };
const agent: AuthenticatedUser = { id: "agent", name: "Agent", email: "a@example.test", role: "AGENT", departmentId: "dept-1", teamIds: ["team-1"], locale: "en" };
const lead: AuthenticatedUser = { ...agent, id: "lead", role: "TEAM_LEAD" };
const admin: AuthenticatedUser = { ...requester, id: "admin", role: "ADMIN" };
const ticket = { id: "ticket-1", requesterId: "requester", assignedAgentId: "agent", assignedTeamId: "team-1", departmentId: "dept-1", deletedAt: null };

describe("ticket access policy", () => {
  it("limits requesters to their own tickets", () => {
    expect(canViewTicket(requester, ticket)).toBe(true);
    expect(canViewTicket({ ...requester, id: "other" }, ticket)).toBe(false);
  });

  it("allows agents and team members to see assigned tickets", () => {
    expect(canViewTicket(agent, ticket)).toBe(true);
    expect(canViewTicket({ ...agent, id: "other", teamIds: [] }, ticket)).toBe(false);
  });

  it("limits team leads to their teams or department", () => {
    expect(canViewTicket(lead, ticket)).toBe(true);
    expect(canViewTicket({ ...lead, teamIds: [], departmentId: "elsewhere" }, ticket)).toBe(false);
  });

  it("allows admins and hides soft-deleted tickets", () => {
    expect(canViewTicket(admin, ticket)).toBe(true);
    expect(canViewTicket(admin, { ...ticket, deletedAt: new Date() })).toBe(false);
  });

  it("only lets team members or admins assign a ticket", () => {
    expect(canAssignTicket(agent, ticket)).toBe(true);
    expect(canAssignTicket(requester, ticket)).toBe(false);
    expect(canAssignTicket(admin, ticket)).toBe(true);
  });

  it("filters internal comments from requester queries", () => {
    expect(visibleCommentWhere(requester)).toEqual({ visibility: "PUBLIC", deletedAt: null });
    expect(visibleCommentWhere(agent)).toEqual({ deletedAt: null });
  });
});

describe("ticket status workflow", () => {
  it.each([
    ["OPEN", "IN_PROGRESS"],
    ["IN_PROGRESS", "PENDING_REQUESTER"],
    ["PENDING_THIRD_PARTY", "IN_PROGRESS"],
    ["IN_PROGRESS", "RESOLVED"],
    ["RESOLVED", "CLOSED"],
    ["RESOLVED", "IN_PROGRESS"],
  ] as const)("allows %s to %s", (from, to) => {
    expect(() => assertStatusTransition(from, to, agent)).not.toThrow();
  });

  it("rejects an invalid state transition as a conflict", () => {
    try {
      assertStatusTransition("OPEN", "RESOLVED", agent);
      throw new Error("Expected transition to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(409);
    }
  });

  it("does not let requesters reopen a closed ticket", () => {
    expect(() => assertStatusTransition("CLOSED", "OPEN", requester)).toThrow(AppError);
  });
});
