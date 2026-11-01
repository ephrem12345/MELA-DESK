import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const validId = /^[a-zA-Z0-9_-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const supplied = req.header("x-request-id");
  req.requestId = supplied && validId.test(supplied) ? supplied : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
};
