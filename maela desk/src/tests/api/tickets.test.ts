import { describe, expect, it } from "vitest";
import { attachmentApi, ticketApi } from "@/lib/api/client";
import { CSRF_TOKEN, bodyOf, installFetchMock, jsonResponse, method } from "../helpers/api";
import type { Ticket } from "@/lib/api/types";

const baseTicket: Ticket = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  ticketNumber: "MD-001001",
  subject: "Email inbox not syncing on mobile",
  description: "New email is not appearing on the mobile device.",
  status: "OPEN",
  priority: "NORMAL",
  category: { id: "c1", name: "email", labelEn: "Email issues", labelAm: "የኢሜይል", active: true, displayOrder: 1 },
  requester: { id: "u1", name: "Sara", email: "sara@meladesk.test" },
  assignedTeam: "Service Desk",
  assignedAgent: null,
  slaDueAt: null,
  slaIndicator: "ON_TRACK",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attachmentCount: 0,
};

function ticketResponse(overrides: Partial<Ticket>, status = 200): Response {
  return jsonResponse({ ticket: { ...baseTicket, ...overrides } }, status);
}

describe("ticketApi — reading tickets from the database API", () => {
  it("list builds the full filter query string", async () => {
    installFetchMock((url) => {
      expect(url.startsWith("/api/tickets?")).toBe(true);
      const query = new URLSearchParams(url.split("?")[1]);
      expect(query.get("status")).toBe("OPEN");
      expect(query.get("priority")).toBe("HIGH");
      expect(query.get("page")).toBe("2");
      expect(query.get("pageSize")).toBe("10");
      expect(query.get("sort")).toBe("createdAt");
      expect(query.get("sortDir")).toBe("asc");
      return jsonResponse({ items: [baseTicket], total: 1, page: 2, pageSize: 10 });
    });

    const result = await ticketApi.list({ status: "OPEN", priority: "HIGH", page: 2, pageSize: 10, sort: "createdAt", sortDir: "asc" });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("list omits empty filter values", async () => {
    installFetchMock((url) => {
      expect(url.indexOf("/api/tickets?")).toBe(0);
      const query = new URLSearchParams(url.split("?")[1]);
      expect(query.get("q")).toBeNull();
      expect(query.get("status")).toBeNull();
      return jsonResponse({ items: [], total: 0, page: 1, pageSize: 25 });
    });

    await ticketApi.list({ q: "", status: undefined });
  });

  it("detail fetches a ticket by id", async () => {
    installFetchMock((url) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}`);
      return jsonResponse({
        ...baseTicket,
        messages: [],
        history: [],
        attachments: [],
        resolution: null,
        requesterEmail: baseTicket.requester.email,
        relatedTicketNumbers: [],
      });
    });

    const detail = await ticketApi.detail(baseTicket.id);
    expect(detail.ticketNumber).toBe("MD-001001");
    expect(detail.messages).toEqual([]);
  });
});

describe("ticketApi — mutating tickets", () => {
  it("create posts the form, CSRF and Idempotency-Key headers", async () => {
    const fetchMock = installFetchMock((url, init) => {
      expect(url).toBe("/api/tickets");
      expect(method([url, init])).toBe("POST");
      return ticketResponse({}, 201);
    });

    const payload = {
      subject: "Printer is offline",
      description: "The office printer stays offline on floor 3.",
      categoryId: "cat-1",
      priority: "NORMAL",
      attachmentIds: [],
    };
    const { ticket } = (await ticketApi.create(payload)) as { ticket: Ticket };
    expect(ticket.ticketNumber).toBe("MD-001001");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe(CSRF_TOKEN);
    expect(headers.get("Idempotency-Key")).toBeTruthy();
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("updateStatus posts to /tickets/:id/status", async () => {
    const fetchMock = installFetchMock((url, init) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/status`);
      expect(method([url, init])).toBe("POST");
      return ticketResponse({ status: "IN_PROGRESS" });
    });

    const { ticket } = (await ticketApi.updateStatus(baseTicket.id, "IN_PROGRESS")) as { ticket: Ticket };
    expect(ticket.status).toBe("IN_PROGRESS");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ status: "IN_PROGRESS" });
  });

  it("assign posts the agent payload", async () => {
    const fetchMock = installFetchMock((url) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/assign`);
      return ticketResponse({ assignedAgent: { id: "agent-1", name: "Dawit" } });
    });

    const { ticket } = (await ticketApi.assign(baseTicket.id, { agentId: "agent-1" })) as { ticket: Ticket };
    expect(ticket.assignedAgent?.name).toBe("Dawit");
    expect(bodyOf(fetchMock.mock.calls[0] as [string, RequestInit])).toEqual({ agentId: "agent-1" });
  });

  it("escalate posts without a body", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/escalate`);
      expect(init.body).toBeUndefined();
      expect(new Headers(init.headers).get("Content-Type")).toBeNull();
      return ticketResponse({ priority: "URGENT" });
    });

    const { ticket } = (await ticketApi.escalate(baseTicket.id)) as { ticket: Ticket };
    expect(ticket.priority).toBe("URGENT");
  });

  it("reply posts the reply with attachments and idempotency", async () => {
    const fetchMock = installFetchMock((url, init) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/replies`);
      expect(JSON.parse(String(init.body))).toEqual({ body: "Here is more info.", attachmentIds: ["att-1"] });
      const headers = new Headers(init.headers);
      expect(headers.get("Idempotency-Key")).toBeTruthy();
      expect(headers.get("X-CSRF-Token")).toBe(CSRF_TOKEN);
      return jsonResponse({ message: { id: "m1" } }, 201);
    });

    const { message } = (await ticketApi.reply(baseTicket.id, "Here is more info.", ["att-1"])) as { message: { id: string } };
    expect(message.id).toBe("m1");
  });

  it("internalNote posts to /tickets/:id/notes", async () => {
    installFetchMock((url) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/notes`);
      return jsonResponse({ message: { id: "m2" } }, 201);
    });

    const { message } = (await ticketApi.internalNote(baseTicket.id, "internal", [])) as { message: { id: string } };
    expect(message.id).toBe("m2");
  });

  it("resolve posts the whole resolution payload", async () => {
    const fetchMock = installFetchMock((url, init) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/resolve`);
      return ticketResponse({ status: "RESOLVED" });
    });

    const payload = {
      summary: "Reconnected the mailbox",
      code: "CONFIG",
      rootCause: "Stale token",
      correctiveAction: "Reauth",
      preventiveAction: "Monitoring",
      publicExplanation: "Fixed.",
    };
    const { ticket } = (await ticketApi.resolve(baseTicket.id, payload)) as { ticket: Ticket };
    expect(ticket.status).toBe("RESOLVED");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual(payload);
  });

  it("reopen posts to /tickets/:id/reopen", async () => {
    installFetchMock((url) => {
      expect(url).toBe(`/api/tickets/${baseTicket.id}/reopen`);
      return ticketResponse({ status: "OPEN" });
    });

    const { ticket } = (await ticketApi.reopen(baseTicket.id)) as { ticket: Ticket };
    expect(ticket.status).toBe("OPEN");
  });
});

describe("attachmentApi", () => {
  it("upload sends multipart form data with CSRF token", async () => {
    const fetchMock = installFetchMock((url, init) => {
      expect(url).toBe("/api/attachments");
      expect(method([url, init])).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      const form = init.body as FormData;
      expect(form.get("file")).toBeInstanceOf(File);
      expect(new Headers(init.headers).get("X-CSRF-Token")).toBe(CSRF_TOKEN);
      return jsonResponse({ id: "att-9" }, 201);
    });

    const file = new File(["hello"], "issue.png", { type: "image/png" });
    const result = await attachmentApi.upload(file);
    expect(result).toEqual({ id: "att-9" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("downloadUrl points at the attachments endpoint", () => {
    expect(attachmentApi.downloadUrl("t-1", "a-1")).toContain("/api/attachments/t-1/a-1");
  });

  it("upload surfaces non-2xx as ApiError", async () => {
    installFetchMock(() => jsonResponse({ success: false }, 401));
    const file = new File(["x"], "note.txt", { type: "text/plain" });
    await expect(attachmentApi.upload(file)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
