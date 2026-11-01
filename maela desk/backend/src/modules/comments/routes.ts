import { Router } from "express";
import { requireAuthentication } from "../../middleware/authenticate.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { commentIdParams, updateCommentSchema } from "../tickets/schemas.js";
import { deleteComment, updateComment } from "../tickets/service.js";
import type { z } from "zod";

export const commentRouter = Router();
commentRouter.use(requireAuthentication);

commentRouter.patch("/:id", validateParams(commentIdParams), validateBody(updateCommentSchema), async (req, res) => {
  res.json({ comment: await updateComment(req, req.authUser!, req.params.id, req.body as z.infer<typeof updateCommentSchema>) });
});

commentRouter.delete("/:id", validateParams(commentIdParams), async (req, res) => {
  await deleteComment(req, req.authUser!, req.params.id);
  res.status(204).end();
});
