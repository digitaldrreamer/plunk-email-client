import { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Prefer HttpOnly cookie; fall back to Bearer header (used for temp tokens in force-change flow)
  const cookieToken = req.cookies?.token as string | undefined;
  const header = req.headers.authorization;
  const raw = cookieToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);

  if (!raw) return res.status(401).json({ success: false, error: "Unauthorized" });
  try {
    req.user = verifyToken(raw);
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}
