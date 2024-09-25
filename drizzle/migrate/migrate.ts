import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import dotenv from 'dotenv';
import { Client } from 'pg';

const migrationsFolder = process.argv[2] ?? '../drizzle';

dotenv.config({ path: __dirname + '/../.env' });

export const dbClient = new Client({
	connectionString: process.env.DATABASE_URL as string
});

const db = drizzle(dbClient);

(async () => {
	await dbClient.connect();
	await migrate(db, { migrationsFolder });
	await dbClient.end();
})();
