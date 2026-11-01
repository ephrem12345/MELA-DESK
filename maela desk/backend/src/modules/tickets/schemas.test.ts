import { describe, expect, it } from "vitest";
import { assignTicketSchema, createTicketSchema, reportRangeQuery, ticketListQuery, updateTicketSchema } from "./schemas.js";

const categoryId = "00000000-0000-4000-8000-000000000001";

describe("ticket request validation", () => {
  it("applies bounded pagination defaults", () => {
    expect(ticketListQuery.parse({}).pageSize).toBe(25);
    expect(ticketListQuery.safeParse({ page: 0 }).success).toBe(false);
    expect(ticketListQuery.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("accepts the current frontend ticket creation shape", () => {
    const payload = { subject: "Need help with access", description: "I cannot access the shared resource.", categoryId, priority: "NORMAL", service: "Account portal", attachmentIds: [] };
    expect(createTicketSchema.parse(payload).priority).toBe("NORMAL");
  });

  it("rejects client-controlled ticket identity and protected fields", () => {
    const payload = { subject: "Need help with access", description: "I cannot access the shared resource.", categoryId, requesterId: categoryId };
    expect(createTicketSchema.safeParse(payload).success).toBe(false);
    expect(updateTicketSchema.safeParse({ status: "RESOLVED" }).success).toBe(false);
  });

  it("allows assignment clearing but validates supplied identifiers", () => {
    expect(assignTicketSchema.safeParse({}).success).toBe(true);
    expect(assignTicketSchema.safeParse({ agentId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an inverted analytics date range", () => {
    expect(reportRangeQuery.safeParse({ from: "2026-06-02", to: "2026-06-01" }).success).toBe(false);
  });
});
