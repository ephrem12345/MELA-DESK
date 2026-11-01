export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, details?: unknown, expose = true) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

export const badRequest = (code = "BAD_REQUEST", message = "The request is invalid.", details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = () => new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
export const forbidden = () => new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");
export const notFound = () => new AppError(404, "NOT_FOUND", "The requested resource was not found.");
export const conflict = (code = "CONFLICT", message = "The request conflicts with the current resource state.") =>
  new AppError(409, code, message);
export const unavailable = () => new AppError(503, "SERVICE_UNAVAILABLE", "A required service is temporarily unavailable.");
