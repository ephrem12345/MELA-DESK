import { z } from "zod";
import { AppError } from "../errors/app-error.js";

const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const intervalSchema = z.object({ start: z.string().regex(timePattern), end: z.string().regex(timePattern) }).strict();
const hoursSchema = z.record(z.enum(dayNames), z.array(intervalSchema));

function minuteOfDay(value: string): number {
  const match = timePattern.exec(value);
  if (!match) throw new AppError(422, "INVALID_SLA_POLICY", "Business hours must use HH:mm values.");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function calculateDeadline(
  start: Date,
  targetMinutes: number,
  policy: { businessHoursEnabled: boolean; businessHours: unknown; holidays: unknown } | null
): Date {
  if (!Number.isFinite(targetMinutes) || targetMinutes < 1) throw new AppError(422, "INVALID_SLA_TARGET", "SLA target minutes must be positive.");
  if (!policy?.businessHoursEnabled) return new Date(start.getTime() + targetMinutes * 60000);

  const parsedHours = hoursSchema.safeParse(policy.businessHours);
  const parsedHolidays = z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).safeParse(policy.holidays ?? []);
  if (!parsedHours.success || !parsedHolidays.success) throw new AppError(422, "INVALID_SLA_POLICY", "Business hours or holiday configuration is invalid.");
  const holidays = new Set(parsedHolidays.data);
  let remaining = targetMinutes;
  let cursor = new Date(start);

  for (let day = 0; day < 370; day += 1) {
    const dayKey = cursor.toISOString().slice(0, 10);
    if (!holidays.has(dayKey)) {
      const windows = parsedHours.data[dayNames[cursor.getUTCDay()]] ?? [];
      for (const window of windows) {
        const startMinute = minuteOfDay(window.start);
        const endMinute = minuteOfDay(window.end);
        if (endMinute <= startMinute) throw new AppError(422, "INVALID_SLA_POLICY", "Business-hour windows must end after they start.");
        const windowStart = new Date(cursor);
        windowStart.setUTCHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
        const windowEnd = new Date(cursor);
        windowEnd.setUTCHours(Math.floor(endMinute / 60), endMinute % 60, 0, 0);
        const availableStart = Math.max(cursor.getTime(), windowStart.getTime());
        if (availableStart >= windowEnd.getTime()) continue;
        const availableMinutes = (windowEnd.getTime() - availableStart) / 60000;
        if (remaining <= availableMinutes) return new Date(availableStart + remaining * 60000);
        remaining -= availableMinutes;
        cursor = windowEnd;
      }
    }
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
  }
  throw new AppError(422, "INVALID_SLA_POLICY", "The SLA target could not be scheduled within the configured calendar.");
}
