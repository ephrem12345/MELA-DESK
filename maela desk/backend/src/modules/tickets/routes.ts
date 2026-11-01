import { Router } from "express";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { commentRateLimit, ticketCreateRateLimit } from "../../middleware/rate-limit.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { ticketIdParams, ticketListQuery, createTicketSchema, updateTicketSchema, assignTicketSchema, statusSchema, prioritySchema, resolveSchema, commentSchema } from "./schemas.js";
import { addComment, assignTicket, changeTicketStatus, closeTicket, createTicket, escalateTicket, getTicket, listComments, listTickets, reopenTicket, resolveTicket, ticketHistory, ticketSla, updateTicket, updateTicketPriority } from "./service.js";
import { z } from "zod";

export const ticketRouter = Router();
ticketRouter.use(requireAuthentication);

ticketRouter.get("/", validateQuery(ticketListQuery), async (req, res) => {
  res.json(await listTickets(req.authUser!, req.validatedQuery as z.infer<typeof ticketListQuery>));
});

ticketRouter.post("/", ticketCreateRateLimit, validateBody(createTicketSchema), async (req, res) => {
  res.status(201).json({ ticket: await createTicket(req, req.authUser!, req.body as z.infer<typeof createTicketSchema>) });
});

ticketRouter.get("/:id/history", validateParams(ticketIdParams), async (req, res) => {
  res.json({ items: await ticketHistory(req, req.authUser!, req.params.id) });
});

ticketRouter.get("/:id/sla", validateParams(ticketIdParams), async (req, res) => {
  res.json(await ticketSla(req, req.authUser!, req.params.id));
});

ticketRouter.get("/:id/comments", validateParams(ticketIdParams), async (req, res) => {
  res.json(await listComments(req, req.authUser!, req.params.id));
});

ticketRouter.post("/:id/comments", commentRateLimit, validateParams(ticketIdParams), validateBody(commentSchema), async (req, res) => {
  res.status(201).json({ comment: await addComment(req, req.authUser!, req.params.id, req.body as z.infer<typeof commentSchema>, "PUBLIC") });
});

// Existing frontend aliases retained while the versioned comments API is available.
ticketRouter.post("/:id/replies", commentRateLimit, validateParams(ticketIdParams), validateBody(commentSchema), async (req, res) => {
  const message = await addComment(req, req.authUser!, req.params.id, req.body as z.infer<typeof commentSchema>, "PUBLIC");
  res.status(201).json({ message });
});

ticketRouter.post("/:id/notes", commentRateLimit, validateParams(ticketIdParams), validateBody(commentSchema), async (req, res) => {
  const message = await addComment(req, req.authUser!, req.params.id, req.body as z.infer<typeof commentSchema>, "INTERNAL");
  res.status(201).json({ message });
});

ticketRouter.post("/:id/assign", validateParams(ticketIdParams), validateBody(assignTicketSchema), async (req, res) => {
  res.json({ ticket: await assignTicket(req, req.authUser!, req.params.id, req.body as z.infer<typeof assignTicketSchema>) });
});

ticketRouter.post("/:id/status", validateParams(ticketIdParams), validateBody(statusSchema), async (req, res) => {
  res.json({ ticket: await changeTicketStatus(req, req.authUser!, req.params.id, req.body as z.infer<typeof statusSchema>) });
});

ticketRouter.post("/:id/priority", validateParams(ticketIdParams), validateBody(prioritySchema), async (req, res) => {
  const body = req.body as z.infer<typeof prioritySchema>;
  res.json({ ticket: await updateTicketPriority(req, req.authUser!, req.params.id, body.priority, body.reason) });
});

ticketRouter.post("/:id/escalate", validateParams(ticketIdParams), async (req, res) => {
  res.json({ ticket: await escalateTicket(req, req.authUser!, req.params.id) });
});

ticketRouter.post("/:id/resolve", validateParams(ticketIdParams), validateBody(resolveSchema), async (req, res) => {
  res.json({ ticket: await resolveTicket(req, req.authUser!, req.params.id, req.body as z.infer<typeof resolveSchema>) });
});

ticketRouter.post("/:id/close", validateParams(ticketIdParams), validateBody(z.object({ reason: z.string().trim().max(500).optional() }).strict()), async (req, res) => {
  res.json({ ticket: await closeTicket(req, req.authUser!, req.params.id, (req.body as { reason?: string }).reason) });
});

ticketRouter.post("/:id/reopen", validateParams(ticketIdParams), async (req, res) => {
  res.json({ ticket: await reopenTicket(req, req.authUser!, req.params.id) });
});

ticketRouter.patch("/:id", validateParams(ticketIdParams), validateBody(updateTicketSchema), async (req, res) => {
  res.json({ ticket: await updateTicket(req, req.authUser!, req.params.id, req.body as z.infer<typeof updateTicketSchema>) });
});

ticketRouter.get("/:id", validateParams(ticketIdParams), async (req, res) => {
  res.json(await getTicket(req, req.authUser!, req.params.id));
});
