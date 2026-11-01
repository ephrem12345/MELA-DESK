import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/client.js";
import { forbidden } from "../errors/app-error.js";

export function requireRoles(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) return next(forbidden());
    next();
  };
}

export const requireAdministrator = requireRoles("ADMIN");
