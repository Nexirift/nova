import { useOIDC } from '@nexirift/plugin-oidc';
import { createYoga } from 'graphql-yoga';
import { redisClient, syncClient, tokenClient } from './redis';
import { db, prodDbClient } from './drizzle/db';
import gradient from 'gradient-string';
import getGitCommitHash from './git';
import { version } from '../package.json';
import { schema } from './schema';
import { Config } from './config';
import { mediaUploadEndpoint, createUsersFromRedisTokens } from './lib/server';
import { isTestMode } from './lib/tests';
import { migrate } from 'drizzle-orm/pglite/migrator';

require('dotenv').config();

// Create a new instance of GraphQL Yoga with the schema and plugins
const yoga = createYoga({
	schema: schema,
	graphiql: false,
	graphqlEndpoint: '/',
	plugins: [useOIDC(Config.OpenID)]
});

export async function startServer() {
	const server = Bun.serve({
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname === '/upload') {
				// TODO: Remove this and use event notifications instead.
				// We are waiting on the Backblaze B2 team to allow us.
				return mediaUploadEndpoint(req);
			} else {
				return yoga.fetch(req);
			}
		}
	});

	// Connect to Redis.
	await redisClient.connect();
	await tokenClient.connect();
	await syncClient.connect();

	if (!isTestMode) {
		// Connect to the database.
		await prodDbClient.connect();
	} else {
		// Migrate the database.
		await migrate(db, { migrationsFolder: './drizzle' });
	}

	// Create users from Redis tokens.
	await createUsersFromRedisTokens();

	// Log the server information to the console.
	console.log('');
	console.log(
		gradient('yellow', 'cyan').multiline(
			[
				'███████╗██████╗  █████╗ ██████╗ ██╗  ██╗',
				'██╔════╝██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝',
				'███████╗██████╔╝███████║██████╔╝█████╔╝ ',
				'╚════██║██╔═══╝ ██╔══██║██╔══██╗██╔═██╗ ',
				'███████║██║     ██║  ██║██║  ██║██║  ██╗',
				'╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝'
			].join('\n')
		)
	);
	console.log('\x1b[32m');
	console.log('⚡ Nexirift Spark API Server');
	console.log(`📦 Version Information: v${version} | ${getGitCommitHash()}`);
	console.log(
		`🔑 Authentication Server: ${
			new URL(process.env.AUTH_INTROSPECT_URL!).hostname
		}`
	);
	console.log(
		`🚀 Serving at ${new URL(
			yoga.graphqlEndpoint,
			`http://${server.hostname}:${server.port}`
		)}`
	);
	if (isTestMode) {
		console.log('🧪 Running in test mode');
	}
	console.log('\x1b[0m');
}

if (process.env.NODE_ENV !== 'test') {
	startServer();
}
