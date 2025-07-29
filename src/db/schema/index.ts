import { pgTable, serial, text } from "drizzle-orm/pg-core";

// Export the default schema
export * from "@nexirift/db/schema";

// Custom schema!!
export const test = pgTable("test", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

// Psst.. you can override the default schema!
// export const user = pgTable("user", {
//   id: serial("id").primaryKey(),
//   email: text("email").notNull(),
// });
