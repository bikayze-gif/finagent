import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { financialGoals } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const goalRoutes = new Hono<AppEnv>();
goalRoutes.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  accountId: z.number().int().positive().nullable().optional(),
  color: z.string().max(7).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  color: z.string().max(7).optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
});

// GET /api/goals
goalRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(financialGoals)
    .where(eq(financialGoals.userId, userId));

  return c.json({ success: true, data: rows });
});

// POST /api/goals
goalRoutes.post("/", validate(createSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  const result = await db.insert(financialGoals).values({
    userId,
    name: body.name,
    description: body.description || null,
    targetAmount: String(body.targetAmount),
    currentAmount: String(body.currentAmount ?? 0),
    targetDate: body.targetDate || null,
    accountId: body.accountId || null,
    color: body.color || "#10b981",
  });

  const id = result[0].insertId;
  const rows = await db.select().from(financialGoals).where(eq(financialGoals.id, id));

  return c.json({ success: true, data: rows[0] }, 201);
});

// PATCH /api/goals/:id
goalRoutes.patch("/:id", validate(updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));
  const body = c.get("validatedBody");

  const existing = await db
    .select()
    .from(financialGoals)
    .where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Goal not found" }, 404);
  }

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.targetAmount !== undefined) updates.targetAmount = String(body.targetAmount);
  if (body.currentAmount !== undefined) updates.currentAmount = String(body.currentAmount);
  if (body.targetDate !== undefined) updates.targetDate = body.targetDate;
  if (body.color !== undefined) updates.color = body.color;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(financialGoals).set(updates).where(eq(financialGoals.id, id));
  const rows = await db.select().from(financialGoals).where(eq(financialGoals.id, id));

  return c.json({ success: true, data: rows[0] });
});

// DELETE /api/goals/:id
goalRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(financialGoals)
    .where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Goal not found" }, 404);
  }

  await db.delete(financialGoals).where(eq(financialGoals.id, id));

  return c.json({ success: true, message: "Meta eliminada" });
});

export default goalRoutes;
