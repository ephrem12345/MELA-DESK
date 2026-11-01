import type { Role } from "../../generated/prisma/client.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  teamIds: string[];
  locale: "en" | "am";
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authUser?: AuthenticatedUser;
      validatedQuery?: unknown;
    }
  }
}

export {};
