import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "../.migrations",
  schema: "./src/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
