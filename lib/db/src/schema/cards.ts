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
  // StroWallet detail fields
  cardType: text("card_type"),
  cardBrand: text("card_brand"),
  reference: text("reference"),
  cardCreatedDate: text("card_created_date"),
  customerEmail: text("customer_email"),
  // Billing address
  billingLine1: text("billing_line1").default("N/A"),
  billingCity: text("billing_city").default("N/A"),
  billingState: text("billing_state").default("N/A"),
  billingPostal: text("billing_postal").default("00000"),
  billingCountry: text("billing_country").default("ETH"),
  billingPhone: text("billing_phone").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Card = typeof cardsTable.$inferSelect;
