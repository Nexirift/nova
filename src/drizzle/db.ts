import { PGlite as testClient } from '@electric-sql/pglite'; // for unit tests use
import { drizzle as prodDrizzle } from 'drizzle-orm/node-postgres'; // for production use
import { drizzle as testDrizzle } from 'drizzle-orm/pglite'; // for unit tests use
import { Client as prodClient } from 'pg'; // for production use
import * as schema from './schema'; // get all the schema

export const prodDbClient = new prodClient({
	connectionString: process.env.DATABASE_URL as string
});

export const db =
	process.env.NODE_ENV !== 'test'
		? prodDrizzle(prodDbClient, { schema }) // we want to use a real database
		: testDrizzle(new testClient(), { schema }); // we want to use a in-memory database
