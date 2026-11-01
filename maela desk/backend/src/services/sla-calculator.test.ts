import { describe, expect, it } from "vitest";
import { calculateDeadline } from "./sla-calculator.js";

describe("SLA deadline calculation", () => {
  it("uses elapsed time when business hours are disabled", () => {
    const start = new Date("2026-10-26T16:00:00.000Z");
    expect(calculateDeadline(start, 120, null).toISOString()).toBe("2026-10-26T18:00:00.000Z");
  });

  it("continues a target across workday windows and skips holidays", () => {
    const start = new Date("2026-10-26T16:00:00.000Z");
    const deadline = calculateDeadline(start, 180, {
      businessHoursEnabled: true,
      businessHours: {
        monday: [{ start: "09:00", end: "17:00" }],
        tuesday: [{ start: "09:00", end: "17:00" }],
        wednesday: [{ start: "09:00", end: "17:00" }],
      },
      holidays: ["2026-10-27"],
    });
    expect(deadline.toISOString()).toBe("2026-10-28T11:00:00.000Z");
  });

  it("rejects malformed configured business windows", () => {
    expect(() => calculateDeadline(new Date(), 60, { businessHoursEnabled: true, businessHours: { monday: [{ start: "17:00", end: "09:00" }] }, holidays: [] })).toThrow();
  });
});
