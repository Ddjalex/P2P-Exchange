import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const internalTransfersTable = pgTable("internal_transfers", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  amount: text("amount").notNull(),
  note: text("note"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInternalTransferSchema = createInsertSchema(internalTransfersTable).omit({ id: true, createdAt: true });
export type InsertInternalTransfer = z.infer<typeof insertInternalTransferSchema>;
export type InternalTransfer = typeof internalTransfersTable.$inferSelect;
