import { describe, expect, it } from "vitest";
import { metaApi, reportsApi } from "@/lib/api/client";
import { installFetchMock, jsonResponse, method } from "../helpers/api";

describe("metaApi — dashboard", () => {
  it("dashboardStats fetches the scoped counters", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/dashboard/stats");
      return jsonResponse({ total: 12, open: 4, inProgress: 3, pending: 1, resolved: 4, urgent: 2 });
    });

    expect(await metaApi.dashboardStats()).toEqual({ total: 12, open: 4, inProgress: 3, pending: 1, resolved: 4, urgent: 2 });
  });
});

describe("metaApi — notifications", () => {
  const notifications = [
    { id: "n1", title: "Ticket created", message: "MD-001001 was created.", read: false, category: "reply", createdAt: new Date().toISOString() },
  ];

  it("notifications returns the paged envelope from the backend", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/notifications");
      return jsonResponse({ items: notifications, total: 1, page: 1, pageSize: 25 });
    });

    const result = await metaApi.notifications();
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("markNotificationRead posts to /notifications/:id/read", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/notifications/n1/read");
      expect(method([url, init])).toBe("POST");
      return jsonResponse(undefined, 204);
    });

    await metaApi.markNotificationRead("n1");
  });

  it("markAllNotificationsRead posts to /notifications/read-all", async () => {
    installFetchMock((url, init) => {
      expect(url).toBe("/api/notifications/read-all");
      expect(method([url, init])).toBe("POST");
      return jsonResponse({ updated: 3 });
    });

    await metaApi.markAllNotificationsRead();
  });

  it("notifications surfaces 401 as ApiError", async () => {
    installFetchMock(() => jsonResponse({}, 401));
    await expect(metaApi.notifications()).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });
});

describe("metaApi — categories", () => {
  it("categories returns the active catalog", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/categories");
      return jsonResponse([
        { id: "c1", name: "hardware", labelEn: "Hardware", labelAm: "ሃርድዌር", active: true, displayOrder: 1 },
      ]);
    });

    const categories = await metaApi.categories();
    expect(categories).toHaveLength(1);
    expect(categories[0].labelEn).toBe("Hardware");
  });
});

describe("reportsApi", () => {
  it("summary requests the days range and returns aggregates", async () => {
    installFetchMock((url) => {
      expect(url).toBe("/api/reports/summary?days=30");
      return jsonResponse({
        volume: [{ date: "2026-10-31", total: 2 }],
        byStatus: [{ label: "Open", total: 2 }],
        byPriority: [{ label: "Normal", total: 2 }],
        byCategory: [{ label: "Hardware", total: 2 }],
        avgFirstResponseMinutes: 42,
        avgResolutionMinutes: 90,
        slaCompliancePct: 95.5,
        reopenRatePct: 2.1,
        agentWorkload: [{ name: "Dawit", total: 5 }],
      });
    });

    const summary = await reportsApi.summary({ days: 30 });
    expect(summary.avgFirstResponseMinutes).toBe(42);
    expect(summary.volume[0].date).toBe("2026-10-31");
    expect(summary.agentWorkload[0].name).toBe("Dawit");
  });
});
