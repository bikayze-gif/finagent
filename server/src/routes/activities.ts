import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { activities } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const activityRoutes = new Hono<AppEnv>();
activityRoutes.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).nullable().optional(),
  frequency: z.enum(["quincenal", "mensual"]),
  amount: z.number().positive().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycleDay: z.number().int().min(1).max(31).nullable().optional(),
  color: z.string().max(7).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
  frequency: z.enum(["quincenal", "mensual"]).optional(),
  amount: z.number().positive().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycleDay: z.number().int().min(1).max(31).nullable().optional(),
  color: z.string().max(7).optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
});

// GET /api/activities
activityRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.userId, userId));

  return c.json({ success: true, data: rows });
});

// POST /api/activities
activityRoutes.post("/", validate(createSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  const result = await db.insert(activities).values({
    userId,
    name: body.name,
    description: body.description || null,
    frequency: body.frequency,
    amount: body.amount != null ? String(body.amount) : null,
    startDate: body.startDate || null,
    cycleDay: body.cycleDay ?? null,
    color: body.color || "#5de6ff",
  });

  const id = result[0].insertId;
  const rows = await db.select().from(activities).where(eq(activities.id, id));

  return c.json({ success: true, data: rows[0] }, 201);
});

// PATCH /api/activities/:id
activityRoutes.patch("/:id", validate(updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));
  const body = c.get("validatedBody");

  const existing = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Actividad no encontrada" }, 404);
  }

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.frequency !== undefined) updates.frequency = body.frequency;
  if (body.amount !== undefined) updates.amount = body.amount != null ? String(body.amount) : null;
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.cycleDay !== undefined) updates.cycleDay = body.cycleDay;
  if (body.color !== undefined) updates.color = body.color;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(activities).set(updates).where(eq(activities.id, id));
  const rows = await db.select().from(activities).where(eq(activities.id, id));

  return c.json({ success: true, data: rows[0] });
});

// DELETE /api/activities/:id
activityRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Actividad no encontrada" }, 404);
  }

  await db.delete(activities).where(eq(activities.id, id));

  return c.json({ success: true, message: "Actividad eliminada" });
});

export default activityRoutes;
