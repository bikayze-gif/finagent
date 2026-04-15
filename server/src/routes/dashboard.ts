import { Hono } from "hono";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { accounts, transactions, categories } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

const dashRoutes = new Hono<AppEnv>();
dashRoutes.use("*", authMiddleware);

// GET /api/dashboard/summary
dashRoutes.get("/summary", async (c) => {
  const userId = c.get("userId");

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  // Total balance across all active accounts
  const balanceResult = await db
    .select({ total: sql<string>`COALESCE(SUM(balance), 0)` })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  // Income and expense totals for current month
  const monthTotals = await db
    .select({
      type: transactions.type,
      total: sql<string>`COALESCE(SUM(amount), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.date} BETWEEN ${monthStart} AND ${monthEnd}`))
    .groupBy(transactions.type);

  const income = monthTotals.find((r) => r.type === "income")?.total || "0";
  const expense = monthTotals.find((r) => r.type === "expense")?.total || "0";

  // Top expense categories this month
  const topCategories = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      total: sql<string>`SUM(amount)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        sql`${transactions.date} BETWEEN ${monthStart} AND ${monthEnd}`
      )
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon, categories.color)
    .orderBy(desc(sql`SUM(amount)`))
    .limit(5);

  // Recent transactions
  const recent = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(10);

  return c.json({
    success: true,
    data: {
      totalBalance: balanceResult[0].total,
      monthIncome: income,
      monthExpense: expense,
      topCategories,
      recentTransactions: recent,
    },
  });
});

// GET /api/dashboard/trend — last 6 months income/expense per month
dashRoutes.get("/trend", async (c) => {
  const userId = c.get("userId");

  const rows = await db
    .select({
      month: sql<string>`DATE_FORMAT(${transactions.date}, '%Y-%m')`,
      type: transactions.type,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.date} >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`,
        sql`${transactions.type} IN ('income', 'expense')`
      )
    )
    .groupBy(sql`DATE_FORMAT(${transactions.date}, '%Y-%m')`, transactions.type)
    .orderBy(sql`DATE_FORMAT(${transactions.date}, '%Y-%m')`);

  // Build sorted month list (last 6 months)
  const monthMap: Record<string, { month: string; income: number; expense: number }> = {};
  for (const row of rows) {
    if (!monthMap[row.month]) {
      monthMap[row.month] = { month: row.month, income: 0, expense: 0 };
    }
    if (row.type === "income") monthMap[row.month].income = Number(row.total);
    if (row.type === "expense") monthMap[row.month].expense = Number(row.total);
  }

  // Ensure all 6 months appear (even empty ones)
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
    result.push(monthMap[key] ?? { month: key, income: 0, expense: 0, label });
    result[result.length - 1].label = label;
  }

  return c.json({ success: true, data: result });
});

// GET /api/dashboard/calendar?month=2026-04
dashRoutes.get("/calendar", async (c) => {
  const userId = c.get("userId");
  const month = c.req.query("month"); // format: YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: "month parameter required (YYYY-MM)" }, 400);
  }

  const year = Number(month.split("-")[0]);
  const mon = Number(month.split("-")[1]);
  const lastDay = new Date(year, mon, 0).getDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, userId), sql`${transactions.date} BETWEEN ${from} AND ${to}`))
    .orderBy(transactions.date, desc(transactions.id));

  // Group by day
  const byDay: Record<string, typeof rows> = {};
  for (const row of rows) {
    const day = String(row.date);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(row);
  }

  return c.json({ success: true, data: byDay });
});

export default dashRoutes;
