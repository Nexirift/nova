import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "@/db/schema";
import { env } from "@/env";

const pool = new Client({
  connectionString: env.DATABASE_URL,
});

export let db = drizzle(pool, {
  schema: schema,
});
