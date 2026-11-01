import { Router } from "express";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { requireAdministrator } from "../../middleware/authorize.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { addTeamMember, createTeam, getTeam, listTeamMembers, listTeams, removeTeamMember, updateTeam } from "./service.js";
import { teamCreateSchema, teamIdParams, teamMemberSchema, teamQuery, teamUpdateSchema, teamUserParams } from "./schemas.js";
import type { z } from "zod";

export const teamRouter = Router();
teamRouter.use(requireAuthentication);
teamRouter.get("/", validateQuery(teamQuery), async (req, res) => res.json(await listTeams(req.authUser!, req.validatedQuery as z.infer<typeof teamQuery>)));
teamRouter.post("/", requireAdministrator, validateBody(teamCreateSchema), async (req, res) => res.status(201).json({ team: await createTeam(req, req.body as z.infer<typeof teamCreateSchema>) }));
teamRouter.get("/:id/members", validateParams(teamIdParams), async (req, res) => res.json(await listTeamMembers(req.authUser!, req.params.id)));
teamRouter.post("/:id/members", validateParams(teamIdParams), validateBody(teamMemberSchema), async (req, res) => res.status(201).json({ member: await addTeamMember(req, req.authUser!, req.params.id, req.body as z.infer<typeof teamMemberSchema>) }));
teamRouter.delete("/:id/members/:userId", validateParams(teamUserParams), async (req, res) => { await removeTeamMember(req, req.authUser!, req.params.id, req.params.userId); res.status(204).end(); });
teamRouter.get("/:id", validateParams(teamIdParams), async (req, res) => res.json({ team: await getTeam(req.authUser!, req.params.id) }));
teamRouter.patch("/:id", validateParams(teamIdParams), validateBody(teamUpdateSchema), async (req, res) => res.json({ team: await updateTeam(req, req.authUser!, req.params.id, req.body as z.infer<typeof teamUpdateSchema>) }));
