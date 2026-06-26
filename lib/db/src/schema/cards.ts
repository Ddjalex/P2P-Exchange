import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique(),
  cardId: text("card_id").unique(),
  cardUserId: text("card_user_id"),
  customerId: text("customer_id"),
  nameOnCard: text("name_on_card"),
  cardStatus: text("card_status").notNull().default("processing"),
  cardNumber: text("card_number"),
  last4: text("last4"),
  cvv: text("cvv"),
  expiry: text("expiry"),
  balance: text("balance").notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Card = typeof cardsTable.$inferSelect;
