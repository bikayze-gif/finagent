import { Hono } from "hono";
import { z } from "zod";
import { eq, or, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { categories } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const catRoutes = new Hono<AppEnv>();
catRoutes.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["income", "expense", "transfer"]),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

const updateSchema = createSchema.partial();

// GET /api/categories — system + user's custom
catRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(categories)
    .where(or(eq(categories.isSystem, true), eq(categories.userId, userId)));

  return c.json({ success: true, data: rows });
});

// POST /api/categories
catRoutes.post("/", validate(createSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  const result = await db.insert(categories).values({
    userId,
    name: body.name,
    type: body.type,
    icon: body.icon || "circle",
    color: body.color || "#64748b",
    parentId: body.parentId || null,
    isSystem: false,
  });

  const id = result[0].insertId;
  const rows = await db.select().from(categories).where(eq(categories.id, id));

  return c.json({ success: true, data: rows[0] }, 201);
});

// PATCH /api/categories/:id — only user's own custom categories
catRoutes.patch("/:id", validate(updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));
  const body = c.get("validatedBody");

  const existing = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Category not found or cannot be modified" }, 404);
  }

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.type !== undefined) updates.type = body.type;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.color !== undefined) updates.color = body.color;

  await db.update(categories).set(updates).where(eq(categories.id, id));
  const rows = await db.select().from(categories).where(eq(categories.id, id));

  return c.json({ success: true, data: rows[0] });
});

// DELETE /api/categories/:id — only user's own custom categories
catRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Category not found or cannot be deleted" }, 404);
  }

  await db.delete(categories).where(eq(categories.id, id));

  return c.json({ success: true, message: "Categoría eliminada" });
});

export default catRoutes;
