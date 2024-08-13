import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/drizzle/schema',
	out: './drizzle',
	dbCredentials: {
		url: process.env.DATABASE_URL as string
	}
});
