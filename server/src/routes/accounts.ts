import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/connection.js";
import { accounts } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const accountRoutes = new Hono<AppEnv>();
accountRoutes.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["checking", "savings", "credit_card", "investment", "cash", "loan", "other"]),
  currency: z.string().length(3).optional(),
  balance: z.number().optional(),
  creditLimit: z.number().nullable().optional(),
  institution: z.string().max(100).nullable().optional(),
  color: z.string().max(7).optional(),
});

const updateSchema = createSchema.partial();

// GET /api/accounts
accountRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  return c.json({ success: true, data: rows });
});

// POST /api/accounts
accountRoutes.post("/", validate(createSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  const result = await db.insert(accounts).values({
    userId,
    name: body.name,
    type: body.type,
    currency: body.currency || "CLP",
    balance: String(body.balance || 0),
    creditLimit: body.creditLimit != null ? String(body.creditLimit) : null,
    institution: body.institution || null,
    color: body.color || "#6366f1",
  });

  const id = result[0].insertId;
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));

  return c.json({ success: true, data: rows[0] }, 201);
});

// PATCH /api/accounts/:id
accountRoutes.patch("/:id", validate(updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));
  const body = c.get("validatedBody");

  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  if (existing.length === 0) {
    return c.json({ success: false, error: "Account not found" }, 404);
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.currency !== undefined) updateData.currency = body.currency;
  if (body.balance !== undefined) updateData.balance = String(body.balance);
  if (body.creditLimit !== undefined) updateData.creditLimit = body.creditLimit != null ? String(body.creditLimit) : null;
  if (body.institution !== undefined) updateData.institution = body.institution;
  if (body.color !== undefined) updateData.color = body.color;

  await db.update(accounts).set(updateData).where(eq(accounts.id, id));
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));

  return c.json({ success: true, data: rows[0] });
});

// DELETE /api/accounts/:id (soft delete)
accountRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  if (existing.length === 0) {
    return c.json({ success: false, error: "Account not found" }, 404);
  }

  await db.update(accounts).set({ isActive: false }).where(eq(accounts.id, id));

  return c.json({ success: true, message: "Account deactivated" });
});

export default accountRoutes;
