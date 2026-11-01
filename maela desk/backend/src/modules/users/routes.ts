import { Router } from "express";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { createUserSchema, updateUserRoleSchema, updateUserSchema, updateUserStatusSchema, userIdParams, usersQuery } from "./schemas.js";
import { createUser, getUser, listUsers, setUserActive, setUserRole, updateUser } from "./service.js";
import type { z } from "zod";

export const userRouter = Router();
userRouter.use(requireAuthentication);

userRouter.get("/", validateQuery(usersQuery), async (req, res) => {
  res.json(await listUsers(req.authUser!, req.validatedQuery as z.infer<typeof usersQuery>));
});
userRouter.post("/", requireAdministrator, validateBody(createUserSchema), async (req, res) => {
  res.status(201).json({ user: await createUser(req, req.body as z.infer<typeof createUserSchema>) });
});
userRouter.get("/:id", validateParams(userIdParams), async (req, res) => {
  res.json({ user: await getUser(req.authUser!, req.params.id) });
});
userRouter.patch("/:id/status", requireAdministrator, validateParams(userIdParams), validateBody(updateUserStatusSchema), async (req, res) => {
  res.json({ user: await setUserActive(req, req.params.id, (req.body as z.infer<typeof updateUserStatusSchema>).active) });
});
userRouter.patch("/:id/role", requireAdministrator, validateParams(userIdParams), validateBody(updateUserRoleSchema), async (req, res) => {
  res.json({ user: await setUserRole(req, req.params.id, (req.body as z.infer<typeof updateUserRoleSchema>).role) });
});
userRouter.patch("/:id", validateParams(userIdParams), validateBody(updateUserSchema), async (req, res) => {
  if (req.authUser?.role !== "ADMIN" && req.authUser?.id !== req.params.id) {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You do not have permission to update this user." } });
  }
  res.json({ user: await updateUser(req, req.params.id, req.body as z.infer<typeof updateUserSchema>) });
});
