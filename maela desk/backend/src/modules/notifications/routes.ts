import { Request, Response, Router } from "express";
import { prisma } from "../../config/database.js";
import { notFound } from "../../errors/app-error.js";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { validateParams } from "../../middleware/validate.js";
import { z } from "zod";

const notificationIdParams = z.object({ id: z.string().uuid() }).strict();
export const notificationRouter = Router();
notificationRouter.use(requireAuthentication);

notificationRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const unreadOnly = req.query.unread === "true";
  const where = { recipientId: req.authUser!.id, ...(unreadOnly ? { readAt: null } : {}) };
  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, include: { ticket: { select: { id: true, ticketNumber: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }),
  ]);
  res.json({
    items: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      ticketId: item.ticket?.id ?? null,
      ticketNumber: item.ticket?.ticketNumber ?? null,
      read: item.readAt !== null,
      category: item.type,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });
});

notificationRouter.get("/unread-count", async (req, res) => {
  const count = await prisma.notification.count({ where: { recipientId: req.authUser!.id, readAt: null } });
  res.json({ count });
});

async function markRead(req: Request, res: Response) {
  const result = await prisma.notification.updateMany({ where: { id: req.params.id, recipientId: req.authUser!.id }, data: { readAt: new Date() } });
  if (result.count !== 1) throw notFound();
  res.status(204).end();
}

notificationRouter.patch("/:id/read", validateParams(notificationIdParams), markRead);
// The current frontend uses POST; keep it as an alias for backwards compatibility.
notificationRouter.post("/:id/read", validateParams(notificationIdParams), markRead);

notificationRouter.post("/read-all", async (req, res) => {
  const result = await prisma.notification.updateMany({ where: { recipientId: req.authUser!.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ updated: result.count });
});
