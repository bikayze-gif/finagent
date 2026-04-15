import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { budgets, transactions, categories } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const budgetRoutes = new Hono<AppEnv>();
budgetRoutes.use("*", authMiddleware);

const createSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  period: z.enum(["monthly", "quarterly", "annual"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  period: z.enum(["monthly", "quarterly", "annual"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/budgets — with spent calculation
budgetRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const rows = await db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      amount: budgets.amount,
      period: budgets.period,
      startDate: budgets.startDate,
      endDate: budgets.endDate,
      isActive: budgets.isActive,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.isActive, true)));

  // Calculate spent for each budget (current month)
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const budgetsWithSpent = await Promise.all(
    rows.map(async (b) => {
      const spent = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.categoryId, b.categoryId),
            eq(transactions.type, "expense"),
            sql`${transactions.date} BETWEEN ${monthStart} AND ${monthEnd}`
          )
        );
      return { ...b, spent: spent[0].total };
    })
  );

  return c.json({ success: true, data: budgetsWithSpent });
});

// POST /api/budgets
budgetRoutes.post("/", validate(createSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  const result = await db.insert(budgets).values({
    userId,
    categoryId: body.categoryId,
    amount: String(body.amount),
    period: body.period || "monthly",
    startDate: body.startDate,
    endDate: body.endDate || null,
  });

  const id = result[0].insertId;
  const rows = await db.select().from(budgets).where(eq(budgets.id, id));

  return c.json({ success: true, data: rows[0] }, 201);
});

// PATCH /api/budgets/:id
budgetRoutes.patch("/:id", validate(updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));
  const body = c.get("validatedBody");

  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Budget not found" }, 404);
  }

  const updates: Record<string, any> = {};
  if (body.amount !== undefined) updates.amount = String(body.amount);
  if (body.period !== undefined) updates.period = body.period;
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.endDate !== undefined) updates.endDate = body.endDate;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  await db.update(budgets).set(updates).where(eq(budgets.id, id));
  const rows = await db.select().from(budgets).where(eq(budgets.id, id));

  return c.json({ success: true, data: rows[0] });
});

// DELETE /api/budgets/:id
budgetRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));

  if (existing.length === 0) {
    return c.json({ success: false, error: "Budget not found" }, 404);
  }

  await db.delete(budgets).where(eq(budgets.id, id));

  return c.json({ success: true, message: "Presupuesto eliminado" });
});

export default budgetRoutes;
