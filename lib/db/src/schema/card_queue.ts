import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const cardQueueTable = pgTable("card_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  cardId: text("card_id"),
  type: text("type").notNull(),
  amount: text("amount"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttempt: timestamp("last_attempt"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CardQueue = typeof cardQueueTable.$inferSelect;
