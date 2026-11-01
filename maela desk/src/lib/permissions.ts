import type { Role } from "@/lib/api/types";

/** Roles that can work tickets (agents, leads, admins). */
export function isStaff(role: Role): boolean {
  return role !== "REQUESTER";
}

/** Which roles may access which top-level app area. */
export const AREA_ROLES: Record<string, Role[]> = {
  agent: ["AGENT", "TEAM_LEAD", "ADMIN"],
  team: ["TEAM_LEAD", "ADMIN"],
  admin: ["ADMIN"],
  dashboard: ["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"],
  tickets: ["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"],
  notifications: ["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"],
  profile: ["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"],
  settings: ["REQUESTER", "AGENT", "TEAM_LEAD", "ADMIN"],
};

/** Extract the top-level area segment from a pathname ("/admin/users" → "admin"). */
export function areaForPathname(pathname: string): string {
  const segment = pathname.split("/")[1] ?? "";
  return segment || "dashboard";
}

/** Whether the role is permitted to view the app area for the pathname. Unknown areas are denied. */
export function isAreaAllowed(role: Role, pathname: string): boolean {
  const area = areaForPathname(pathname);
  return AREA_ROLES[area]?.includes(role) ?? false;
}
