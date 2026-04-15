import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../services/auth.service.js";
import type { AppEnv } from "../types.js";

const auth = new Hono<AppEnv>();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(150),
  password: z.string().min(8).max(100),
  currency: z.string().length(3).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(50).optional(),
});

// POST /api/auth/register
auth.post("/register", validate(registerSchema), async (c) => {
  const body = c.get("validatedBody");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
  if (existing.length > 0) {
    return c.json({ success: false, error: "Email already registered" }, 409);
  }

  const passwordHash = await hashPassword(body.password);
  const result = await db.insert(users).values({
    name: body.name,
    email: body.email,
    passwordHash,
    currency: body.currency || "CLP",
  });

  const userId = result[0].insertId;
  const payload = { userId, email: body.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return c.json({
    success: true,
    data: {
      user: { id: userId, name: body.name, email: body.email, currency: body.currency || "CLP" },
      accessToken,
      refreshToken,
    },
  }, 201);
});

// POST /api/auth/login
auth.post("/login", validate(loginSchema), async (c) => {
  const body = c.get("validatedBody");

  const rows = await db.select().from(users).where(eq(users.email, body.email));
  if (rows.length === 0) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const user = rows[0];
  const valid = await comparePassword(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const payload = { userId: user.id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return c.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, currency: user.currency },
      accessToken,
      refreshToken,
    },
  });
});

// POST /api/auth/refresh
auth.post("/refresh", validate(refreshSchema), async (c) => {
  const { refreshToken } = c.get("validatedBody");

  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = generateAccessToken({ userId: payload.userId, email: payload.email });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, email: payload.email });

    return c.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch {
    return c.json({ success: false, error: "Invalid refresh token" }, 401);
  }
});

// GET /api/auth/me
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      currency: users.currency,
      timezone: users.timezone,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (rows.length === 0) {
    return c.json({ success: false, error: "User not found" }, 404);
  }

  return c.json({ success: true, data: rows[0] });
});

// PATCH /api/auth/profile
auth.patch("/profile", authMiddleware, validate(profileSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.timezone !== undefined) updates.timezone = body.timezone;

  if (Object.keys(updates).length === 0) {
    return c.json({ success: false, error: "No fields to update" }, 400);
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, currency: users.currency, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));

  return c.json({ success: true, data: rows[0] });
});

export default auth;
