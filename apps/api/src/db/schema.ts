import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(), // Este será nuestro Student ID en el contrato
  name: text("name").notNull(),
  password: text("password").notNull(),
  walletAddress: text("wallet_address"), // Guardamos el reflejo de la billetera actual
  balance: real("balance").default(0), // Balance sincronizado con la blockchain
  role: text("role").default('student'), // student, admin, cafeteria
  
  // --- Hexágono de Mérito (v2.0) ---
  // 1. Intelecto
  statIntellect: real("stat_intellect").default(0), // 0.0 - 3.0
  
  // 2. Fortaleza (Híbrido Running)
  statStrengthConsistency: integer("stat_strength_consistency").default(0), // Sesiones/mes
  statStrengthPR5k: integer("stat_strength_pr_5k").default(0), // Tiempo en segundos
  statStrengthPR10k: integer("stat_strength_pr_10k").default(0), // Tiempo en segundos
  statStrengthPR21k: integer("stat_strength_pr_21k").default(0), // Tiempo en segundos
  
  // 3. Estrategia
  statStrategy: integer("stat_strategy").default(1200), // ELO Ajedrez
  
  // 4. Zen
  statZen: integer("stat_zen").default(0), // Minutos totales meditación
  
  // 5. Servicio
  statService: integer("stat_service").default(0), // Horas acumuladas
  
  // 6. Honor
  statHonor: real("stat_honor").default(5.0), // Promedio P2P (0.0 - 5.0)
  
  creditScore: integer("credit_score").default(0), // Score total (0-100)
  activeLoan: real("active_loan").default(0), // Deuda actual
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
