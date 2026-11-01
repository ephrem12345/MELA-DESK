import { Prisma } from "../../generated/prisma/client.js";
import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../errors/app-error.js";

export const routeNotFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let mapped: AppError;
  if (error instanceof AppError) {
    mapped = error;
  } else if (error instanceof ZodError) {
    mapped = new AppError(422, "VALIDATION_ERROR", "The request contains invalid data.", error.issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message })));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    mapped = new AppError(409, "DUPLICATE_RESOURCE", "A resource with those details already exists.");
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    mapped = new AppError(404, "NOT_FOUND", "The requested resource was not found.");
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    mapped = new AppError(409, "RELATED_RESOURCE_CONFLICT", "The operation conflicts with a related resource.");
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    mapped = new AppError(503, "DATABASE_UNAVAILABLE", "A required service is temporarily unavailable.");
  } else if (error instanceof multer.MulterError) {
    mapped = new AppError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "UPLOAD_REJECTED", "The uploaded file could not be accepted.");
  } else {
    mapped = new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred.", undefined, false);
  }

  const status = mapped.status;
  if (status >= 500) {
    logger.error({ errorName: error instanceof Error ? error.name : "UnknownError", requestId: req.requestId, route: req.path, method: req.method }, "request failed");
  } else {
    logger.warn({ code: mapped.code, requestId: req.requestId, route: req.path, method: req.method }, "request rejected");
  }

  res.status(status).json({
    success: false,
    error: {
      code: mapped.code,
      message: mapped.expose ? mapped.message : "An unexpected error occurred.",
      details: mapped.expose ? (mapped.details ?? []) : [],
      requestId: req.requestId,
    },
  });
};
