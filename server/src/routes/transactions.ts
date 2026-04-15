import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "../db/connection.js";
import { transactions, accounts } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const txRoutes = new Hono<AppEnv>();
txRoutes.use("*", authMiddleware);

const createSchema = z.object({
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullable().optional(),
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive(),
  description: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(100).nullable().optional(),
  transferToAccountId: z.number().int().positive().nullable().optional(),
});

const updateSchema = createSchema.partial();

async function updateAccountBalance(accountId: number, amountDelta: number) {
  await db
    .update(accounts)
    .set({ balance: sql`balance + ${amountDelta}` })
    .where(eq(accounts.id, accountId));
}

function getBalanceDelta(type: string, amount: number): number {
  if (type === "income") return amount;
  if (type === "expense") return -amount;
  return -amount; // transfer: outgoing
}

// GET /api/transactions?page=1&limit=20&type=expense&from=2026-04-01&to=2026-04-30&categoryId=5
txRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const page = Number(c.req.query("page")) || 1;
  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
  const offset = (page - 1) * limit;
  const typeFilter = c.req.query("type");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const categoryId = c.req.query("categoryId");

  const conditions = [eq(transactions.userId, userId)];
  if (typeFilter) conditions.push(eq(transactions.type, typeFilter as "income" | "expense" | "transfer"));
  if (from && to) conditions.push(sql`${transactions.date} BETWEEN ${from} AND ${to}`);
  if (categoryId) conditions.push(eq(transactions.categoryId, Number(categoryId)));

  const where = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(transactions).where(where),
  ]);

  const total = totalResult[0].total;

  return c.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// POST /api/transactions
txRoutes.post("/", validate(createSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.get("validatedBody");

  // Verify account belongs to user
  const acct = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)));
  if (acct.length === 0) {
    return c.json({ success: false, error: "Account not found" }, 404);
  }

  const result = await db.insert(transactions).values({
    userId,
    accountId: body.accountId,
    categoryId: body.categoryId || null,
    type: body.type,
    amount: String(body.amount),
    description: body.description || null,
    notes: body.notes || null,
    date: body.date,
    isRecurring: body.isRecurring || false,
    recurrenceRule: body.recurrenceRule || null,
    transferToAccountId: body.transferToAccountId || null,
  });

  // Update account balance
  await updateAccountBalance(body.accountId, getBalanceDelta(body.type, body.amount));
  if (body.type === "transfer" && body.transferToAccountId) {
    await updateAccountBalance(body.transferToAccountId, body.amount);
  }

  const id = result[0].insertId;
  const rows = await db.select().from(transactions).where(eq(transactions.id, id));

  return c.json({ success: true, data: rows[0] }, 201);
});

// PATCH /api/transactions/:id
txRoutes.patch("/:id", validate(updateSchema), async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));
  const body = c.get("validatedBody");

  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  if (existing.length === 0) {
    return c.json({ success: false, error: "Transaction not found" }, 404);
  }

  const old = existing[0];

  // Reverse old balance effect
  await updateAccountBalance(old.accountId, -getBalanceDelta(old.type, Number(old.amount)));
  if (old.type === "transfer" && old.transferToAccountId) {
    await updateAccountBalance(old.transferToAccountId, -Number(old.amount));
  }

  const updateData: Record<string, unknown> = {};
  if (body.accountId !== undefined) updateData.accountId = body.accountId;
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.amount !== undefined) updateData.amount = String(body.amount);
  if (body.description !== undefined) updateData.description = body.description;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.date !== undefined) updateData.date = body.date;

  await db.update(transactions).set(updateData).where(eq(transactions.id, id));

  // Apply new balance effect
  const newType = body.type || old.type;
  const newAmount = body.amount || Number(old.amount);
  const newAccountId = body.accountId || old.accountId;
  await updateAccountBalance(newAccountId, getBalanceDelta(newType, newAmount));
  if (newType === "transfer") {
    const newTransferTo = body.transferToAccountId || old.transferToAccountId;
    if (newTransferTo) await updateAccountBalance(newTransferTo, newAmount);
  }

  const rows = await db.select().from(transactions).where(eq(transactions.id, id));
  return c.json({ success: true, data: rows[0] });
});

// DELETE /api/transactions/:id
txRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  if (existing.length === 0) {
    return c.json({ success: false, error: "Transaction not found" }, 404);
  }

  const old = existing[0];
  // Reverse balance
  await updateAccountBalance(old.accountId, -getBalanceDelta(old.type, Number(old.amount)));
  if (old.type === "transfer" && old.transferToAccountId) {
    await updateAccountBalance(old.transferToAccountId, -Number(old.amount));
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  return c.json({ success: true, message: "Transaction deleted" });
});

export default txRoutes;
