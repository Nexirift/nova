import { vi } from "vitest";
import * as schema from "./src/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

import "./src/server";

/**
 * Creates a mock database for testing
 * Uses PGlite in-memory database with schema applied
 */
async function MOCK_DB() {
  // Use require to work around dynamic import issues
  // See: https://github.com/drizzle-team/drizzle-orm/issues/2853#issuecomment-2668459509
  const { createRequire } =
    await vi.importActual<typeof import("node:module")>("node:module");
  const require = createRequire(import.meta.url);
  const { pushSchema } =
    require("drizzle-kit/api") as typeof import("drizzle-kit/api");

  // Initialize in-memory database
  const client = new PGlite({ extensions: { citext } });
  const db = drizzle(client, { schema });

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS citext;`);

  // Apply schema to database
  const { apply } = await pushSchema(schema, db as any);
  await apply();

  await db.insert(schema.test).values({ id: 999, name: "Test!!" });

  return { db, ...schema };
}

/**
 * Creates a mock Redis client for testing
 * Uses redis-memory-server for in-memory Redis instance
 */
async function MOCK_REDIS() {
  // Use require to work around dynamic import issues
  const { createRequire } =
    await vi.importActual<typeof import("node:module")>("node:module");
  const require = createRequire(import.meta.url);
  const Redis = require("ioredis").default;
  const { RedisMemoryServer } = require("redis-memory-server");

  // Initialize in-memory Redis server
  const redisServer = new RedisMemoryServer();
  const host = await redisServer.getHost();
  const port = await redisServer.getPort();

  // Connect to in-memory Redis server
  const redisClient = new Redis({
    host,
    port,
  });

  return { redisClient, redisServer };
}

// Register mock implementations
vi.mock("./src/db", MOCK_DB);
vi.mock("./src/redis", MOCK_REDIS);
