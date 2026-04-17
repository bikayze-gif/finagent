import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import auth from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import txRoutes from "./routes/transactions.js";
import catRoutes from "./routes/categories.js";
import budgetRoutes from "./routes/budgets.js";
import dashRoutes from "./routes/dashboard.js";
import goalRoutes from "./routes/goals.js";
import activityRoutes from "./routes/activities.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", service: "finagent-api" }));

// Routes
app.route("/api/auth", auth);
app.route("/api/accounts", accountRoutes);
app.route("/api/transactions", txRoutes);
app.route("/api/categories", catRoutes);
app.route("/api/budgets", budgetRoutes);
app.route("/api/dashboard", dashRoutes);
app.route("/api/goals", goalRoutes);
app.route("/api/activities", activityRoutes);

// 404 fallback
app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { success: false, error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message },
    500
  );
});

const port = Number(process.env.PORT) || 5010;
console.log(`FinAgent API running on port ${port}`);

serve({ fetch: app.fetch, port });
