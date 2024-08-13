import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const dbClient = new Client({
	connectionString: process.env.DATABASE_URL as string
});

export const db = drizzle(dbClient, { schema });
