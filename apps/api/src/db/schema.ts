import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  balance: real("balance").default(0.0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  amount: real("amount").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const missionCategories = sqliteTable("mission_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // Mecánica, Tutoría, Limpieza, etc.
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const missions = sqliteTable("missions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorId: integer("creator_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id").notNull().references(() => missionCategories.id),
  reward: real("reward").notNull(),
  slots: integer("slots").default(1),
  whatsapp: text("whatsapp"),
  status: text("status").default('open'), // open, assigned, completed, cancelled
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const missionApplications = sqliteTable("mission_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id").notNull().references(() => missions.id),
  studentId: integer("student_id").notNull().references(() => users.id),
  status: text("status").default('pending'), // pending, accepted, rejected, completed
  comment: text("comment"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});
