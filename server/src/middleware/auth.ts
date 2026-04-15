import { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import type { AppEnv } from "../types.js";

export interface JwtPayload {
  userId: number;
  email: string;
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "No token provided" }, 401);
  }

  const token = header.slice(7);

  // DEV BYPASS: accept a fixed token in development mode
  if (process.env.NODE_ENV === "development" && token === "dev-bypass-token") {
    c.set("userId", 1);
    c.set("email", "dev@finagent.local");
    await next();
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    c.set("userId", payload.userId);
    c.set("email", payload.email);
    await next();
  } catch {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }
}
