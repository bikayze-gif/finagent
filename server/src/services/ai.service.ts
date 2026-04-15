import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/connection.js";
import { transactions, accounts, budgets, categories, financialGoals } from "../db/schema.js";
import { eq, and, gte, desc, sql } from "drizzle-orm";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function buildFinancialContext(userId: number): Promise<string> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const fromDate = ninetyDaysAgo.toISOString().split("T")[0];

  // Accounts
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  // Last 50 transactions
  const recentTx = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.date} >= ${fromDate}`
      )
    )
    .orderBy(desc(transactions.date))
    .limit(50);

  // Monthly summary (last 6 months)
  const monthlySummary = await db
    .select({
      month: sql<string>`DATE_FORMAT(${transactions.date}, '%Y-%m')`,
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.date} >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`
      )
    )
    .groupBy(sql`DATE_FORMAT(${transactions.date}, '%Y-%m')`, transactions.type)
    .orderBy(sql`DATE_FORMAT(${transactions.date}, '%Y-%m')`);

  // Active budgets
  const activeBudgets = await db
    .select({
      id: budgets.id,
      amount: budgets.amount,
      period: budgets.period,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.isActive, true)));

  // Goals
  const goals = await db
    .select()
    .from(financialGoals)
    .where(and(eq(financialGoals.userId, userId), eq(financialGoals.status, "active")));

  // Build context string
  const totalBalance = userAccounts.reduce(
    (sum, a) => sum + parseFloat(String(a.balance)),
    0
  );

  let ctx = `DATOS FINANCIEROS DEL USUARIO (al ${new Date().toLocaleDateString("es-CL")})\n\n`;

  ctx += `CUENTAS:\n`;
  for (const acc of userAccounts) {
    ctx += `- ${acc.name} (${acc.type}): $${Number(acc.balance).toLocaleString("es-CL")} CLP\n`;
  }
  ctx += `Balance total: $${totalBalance.toLocaleString("es-CL")} CLP\n\n`;

  // Monthly summary
  const monthMap: Record<string, { income: number; expense: number }> = {};
  for (const row of monthlySummary) {
    if (!monthMap[row.month]) monthMap[row.month] = { income: 0, expense: 0 };
    if (row.type === "income") monthMap[row.month].income = Number(row.total);
    if (row.type === "expense") monthMap[row.month].expense = Number(row.total);
  }
  ctx += `RESUMEN MENSUAL:\n`;
  for (const [month, data] of Object.entries(monthMap).slice(-6)) {
    const savings = data.income - data.expense;
    ctx += `- ${month}: Ingresos $${data.income.toLocaleString("es-CL")}, Gastos $${data.expense.toLocaleString("es-CL")}, Ahorro $${savings.toLocaleString("es-CL")}\n`;
  }
  ctx += "\n";

  ctx += `ÚLTIMAS TRANSACCIONES (últimos 90 días):\n`;
  for (const tx of recentTx.slice(0, 20)) {
    const sign = tx.type === "income" ? "+" : "-";
    ctx += `- [${tx.date}] ${sign}$${Number(tx.amount).toLocaleString("es-CL")} | ${tx.categoryName || "Sin categoría"} | ${tx.description || ""}\n`;
  }
  ctx += "\n";

  if (activeBudgets.length > 0) {
    ctx += `PRESUPUESTOS ACTIVOS:\n`;
    for (const b of activeBudgets) {
      ctx += `- ${b.categoryName}: límite $${Number(b.amount).toLocaleString("es-CL")} (${b.period})\n`;
    }
    ctx += "\n";
  }

  if (goals.length > 0) {
    ctx += `METAS FINANCIERAS:\n`;
    for (const g of goals) {
      const pct = Math.round(
        (Number(g.currentAmount) / Number(g.targetAmount)) * 100
      );
      ctx += `- ${g.name}: $${Number(g.currentAmount).toLocaleString("es-CL")} / $${Number(g.targetAmount).toLocaleString("es-CL")} (${pct}%)${g.targetDate ? ` — meta: ${g.targetDate}` : ""}\n`;
    }
  }

  return ctx;
}

export async function chatWithAI(
  userId: number,
  userMessage: string,
  history: ChatMessage[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "⚠️ El agente AI no está configurado. Agrega ANTHROPIC_API_KEY en el archivo .env del servidor para activar esta función.";
  }

  const financialContext = await buildFinancialContext(userId);

  const systemPrompt = `Eres FinAgent, un asistente financiero personal inteligente. Tienes acceso a los datos financieros reales del usuario.

${financialContext}

INSTRUCCIONES:
- Responde siempre en español
- Sé conciso, directo y útil
- Usa los datos reales del usuario en tus respuestas
- Cuando des cifras, usa el formato CLP chileno
- Si el usuario pregunta por tendencias o patrones, analiza los datos del resumen mensual
- Ofrece sugerencias prácticas y específicas basadas en sus datos
- No inventes datos que no estén en el contexto`;

  const messages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "Sin respuesta";
}

export async function generateInsights(userId: number): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  try {
    const financialContext = await buildFinancialContext(userId);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `Eres un analista financiero. Analiza los datos y genera exactamente 3 insights breves (máx 15 palabras cada uno) sobre la situación financiera del usuario. Devuelve SOLO un JSON array de strings, sin explicaciones. Ejemplo: ["insight 1", "insight 2", "insight 3"]`,
      messages: [
        { role: "user", content: `Analiza estos datos:\n${financialContext}` },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") return [];

    const jsonMatch = block.text.match(/\[.*\]/s);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as string[];
  } catch {
    return [];
  }
}
