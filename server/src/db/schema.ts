import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  date,
  mysqlEnum,
  char,
  primaryKey,
  index,
} from "drizzle-orm/mysql-core";

// ==========================================
// USERS
// ==========================================
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("CLP"),
  timezone: varchar("timezone", { length: 50 }).notNull().default("America/Santiago"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ==========================================
// ACCOUNTS
// ==========================================
export const accounts = mysqlTable("accounts", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", [
    "checking", "savings", "credit_card", "investment", "cash", "loan", "other",
  ]).notNull().default("checking"),
  currency: char("currency", { length: 3 }).notNull().default("CLP"),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }),
  institution: varchar("institution", { length: 100 }),
  color: char("color", { length: 7 }).default("#6366f1"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ==========================================
// CATEGORIES
// ==========================================
export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["income", "expense", "transfer"]).notNull(),
  icon: varchar("icon", { length: 50 }).default("circle"),
  color: char("color", { length: 7 }).default("#64748b"),
  parentId: int("parent_id"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==========================================
// TRANSACTIONS
// ==========================================
export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: int("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: int("category_id").references(() => categories.id, { onDelete: "set null" }),
    type: mysqlEnum("type", ["income", "expense", "transfer"]).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    description: varchar("description", { length: 255 }),
    notes: text("notes"),
    date: date("date").notNull(),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurrenceRule: varchar("recurrence_rule", { length: 100 }),
    transferToAccountId: int("transfer_to_account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => [
    index("idx_date").on(table.date),
    index("idx_user_date").on(table.userId, table.date),
    index("idx_account").on(table.accountId),
  ]
);

// ==========================================
// TAGS
// ==========================================
export const tags = mysqlTable("tags", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  color: char("color", { length: 7 }).default("#94a3b8"),
});

export const transactionTags = mysqlTable(
  "transaction_tags",
  {
    transactionId: int("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    tagId: int("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.tagId] })]
);

// ==========================================
// BUDGETS
// ==========================================
export const budgets = mysqlTable("budgets", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: int("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  period: mysqlEnum("period", ["monthly", "quarterly", "annual"]).notNull().default("monthly"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==========================================
// AI CONVERSATIONS
// ==========================================
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }),
  messages: text("messages").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ==========================================
// ACTIVITIES
// ==========================================
export const activities = mysqlTable("activities", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  frequency: mysqlEnum("frequency", ["quincenal", "mensual"]).notNull().default("mensual"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  startDate: date("start_date"),
  cycleDay: int("cycle_day"),
  status: mysqlEnum("status", ["active", "paused", "completed", "cancelled"]).notNull().default("active"),
  color: char("color", { length: 7 }).default("#5de6ff"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ==========================================
// FINANCIAL GOALS
// ==========================================
export const financialGoals = mysqlTable("financial_goals", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: int("account_id").references(() => accounts.id, { onDelete: "set null" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  targetDate: date("target_date"),
  status: mysqlEnum("status", ["active", "paused", "completed", "cancelled"]).notNull().default("active"),
  color: char("color", { length: 7 }).default("#10b981"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
