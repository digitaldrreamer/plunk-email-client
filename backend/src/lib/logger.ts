import { type Request, type Response, type NextFunction } from "express";

interface LogMeta {
  action?: string;
  userId?: string;
  userEmail?: string;
  [key: string]: unknown;
}

function emit(level: "info" | "warn" | "error", message: string, meta: LogMeta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// Drizzle/postgres-js wrap the real Postgres error (code/detail/constraint) in `.cause`,
// and `String(err)` only yields "Error: Failed query: ..." — surface the cause too.
export function describeError(err: unknown): { error: string; cause?: { message?: string; code?: string; detail?: string; constraint?: string } } {
  const e = err as { message?: string; cause?: { message?: string; code?: string; detail?: string; constraint_name?: string; constraint?: string } };
  const cause = e?.cause;
  return {
    error: e?.message ?? String(err),
    ...(cause && {
      cause: {
        message: cause.message,
        code: cause.code,
        detail: cause.detail,
        constraint: cause.constraint_name ?? cause.constraint,
      },
    }),
  };
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit("info", message, meta),
  warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
  error: (message: string, meta?: LogMeta) => emit("error", message, meta),
};

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const user = (req as Request & { user?: { sub?: string; email?: string } }).user;
    emit("info", `${req.method} ${req.path} ${res.statusCode}`, {
      action: "http_request",
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      userId: user?.sub,
      userEmail: user?.email,
      ip: req.ip,
    });
  });

  next();
}
