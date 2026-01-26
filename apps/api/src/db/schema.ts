import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(), // Este será nuestro Student ID en el contrato
  name: text("name").notNull(),
  password: text("password").notNull(),
  walletAddress: text("wallet_address"), // Guardamos el reflejo de la billetera actual
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  txHash: text("tx_hash").notNull().unique(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: 'set null' }),
  receiverId: integer("receiver_id").references(() => users.id, { onDelete: 'set null' }),
  senderEmail: text("sender_email"), // Cache del correo en el momento de la tx
  receiverEmail: text("receiver_email"),
  amount: real("amount").notNull(),
  description: text("description"),
  status: text("status").default('pending'), // pending, success, failed
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const missionCategories = sqliteTable("mission_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // Mecánica, Tutoría, Limpieza, etc.
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const missions = sqliteTable("missions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorId: integer("creator_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id").notNull().references(() => missionCategories.id, { onDelete: 'cascade' }),
  reward: real("reward").notNull(),
  whatsapp: text("whatsapp"),
  status: text("status").default('open'), // open, assigned, completed, cancelled
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const missionApplications = sqliteTable("mission_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id").notNull().references(() => missions.id, { onDelete: 'cascade' }),
  studentId: integer("student_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text("status").default('pending'), // pending, accepted, rejected, completed
  bidAmount: real("bid_amount").notNull(),
  comment: text("comment"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactName: text("contact_name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const kvMetadata = sqliteTable("kv_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});
