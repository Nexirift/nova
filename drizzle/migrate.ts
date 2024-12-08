import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { sql } from 'drizzle-orm';

const migrationsFolder = process.argv[2] ?? '../drizzle';

console.log(process.env.DATABASE_URL);

export const dbClient = new Client({
	connectionString: process.env.DATABASE_URL as string
});

const db = drizzle(dbClient);

(async () => {
	await dbClient.connect();
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS citext;`);
	await migrate(db, { migrationsFolder });
	await dbClient.end();
})();
