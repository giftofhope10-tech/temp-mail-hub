import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tempEmails = pgTable("temp_emails", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email_address: text("email_address").notNull().unique(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`now() + interval '24 hours'`),
});

export const receivedEmails = pgTable("received_emails", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  temp_email_id: uuid("temp_email_id").notNull().references(() => tempEmails.id, { onDelete: "cascade" }),
  from_address: text("from_address").notNull(),
  subject: text("subject").default(""),
  body_text: text("body_text").default(""),
  body_html: text("body_html").default(""),
  is_read: boolean("is_read").notNull().default(false),
  received_at: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  api_key: text("api_key").unique().notNull(),
  email: text("email").notNull(),
  plan: text("plan").notNull().default("free"),
  allowed_domains: text("allowed_domains").array().notNull().default(sql`ARRAY['kameti.online']::text[]`),
  rate_limit_per_minute: integer("rate_limit_per_minute").notNull().default(10),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiUsage = pgTable("api_usage", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  api_key_id: uuid("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  requested_at: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
});
