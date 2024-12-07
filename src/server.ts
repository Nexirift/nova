import { useOIDC } from '@nexirift/plugin-oidc';
import { beforeAll } from 'bun:test';
import { migrate } from 'drizzle-orm/pglite/migrator';
import gradient from 'gradient-string';
import { createYoga } from 'graphql-yoga';
import { version } from '../package.json';
import { Config } from './config';
import { db, prodDbClient } from './drizzle/db';
import getGitCommitHash from './git';
import {
	createUsersFromRedisTokens,
	mediaUploadEndpoint,
	webhookEndpoint
} from './lib/server';
import { isTestMode } from './lib/server';
import { redisClient, syncClient, tokenClient } from './redis';
import { schema } from './schema';
import { enableAll } from './lib/logger';
import { makeHandler, handleProtocols } from 'graphql-ws/lib/use/bun';
import { pubsub } from './pubsub';
import { sql } from 'drizzle-orm';

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
		async fetch(req, server) {
			// determine whether or not the user is trying to access websockets
			// this probably isn't perfect but i don't know any other ways to do this
			if (
				req.headers.get('sec-websocket-protocol') ||
				req.headers.get('sec-websocket-version') ||
				req.headers.get('sec-websocket-key') ||
				req.headers.get('sec-websocket-extensions') ||
				req.headers.get('upgrade') === 'websocket' ||
				req.headers.get('connection') === 'upgrade'
			) {
				if (req.headers.get('upgrade') != 'websocket') {
					return new Response('Upgrade Required', {
						status: 426
					});
				}
				if (
					!handleProtocols(
						req.headers.get('sec-websocket-protocol') || ''
					)
				) {
					return new Response('Bad Request', { status: 404 });
				}
				if (!server.upgrade(req)) {
					return new Response('Internal Server Error', {
						status: 500
					});
				}
				return new Response();
			} else {
				const url = new URL(req.url);
				if (url.pathname === '/upload') {
					// TODO: Remove this and use event notifications instead.
					// We are waiting on the Backblaze B2 team to allow us.
					return mediaUploadEndpoint(req);
				} else if (url.pathname === '/wstest') {
					pubsub.publish('dbUpdatedUser', {});
					return new Response();
				} else if (url.pathname.startsWith('/webhook/')) {
					return webhookEndpoint(req);
				} else {
					return yoga.fetch(req);
				}
			}
		},
		websocket: makeHandler({ schema, context: { pubsub } }),
		port: isTestMode ? 25447 : process.env.PORT ?? 3000
	});

	// Connect to Redis.
	await redisClient.connect();
	await tokenClient.connect();
	await syncClient.connect();

	if (!isTestMode) {
		// Connect to the database.
		await prodDbClient.connect();

		// Create users from Redis tokens.
		await createUsersFromRedisTokens();
	} else {
		// Migrate the database.
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS citext;`);
		await migrate(db, { migrationsFolder: './drizzle' });
	}

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
	if (!isTestMode) {
		console.log(
			`🔑 Authentication Server: ${
				new URL(process.env.AUTH_INTROSPECT_URL!).hostname
			}`
		);
	} else {
		console.log('🔑 Authentication Server: Test Mode');
	}
	console.log(
		`🚀 Serving HTTP at ${new URL(
			yoga.graphqlEndpoint,
			`http://${server.hostname}:${server.port}`
		)}`
	);
	console.log(
		`🔌 Serving WS at ${new URL(
			yoga.graphqlEndpoint,
			`ws://${server.hostname}:${server.port}`
		)}`
	);
	if (isTestMode) {
		enableAll();
		console.log('🧪 Running in test mode');
	}
	console.log('\x1b[0m');

	if (
		(await db
			.execute(
				sql`SELECT * FROM pg_available_extensions WHERE name = 'citext';`
			)
			.then((r) => r.rows[0].installed_version)) === null
	) {
		console.log(
			'🔑 Citext extension has not been found on the database. We will attempt to install it now.'
		);
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS citext;`);
	}
}

if (!isTestMode) {
	startServer();
} else {
	beforeAll(async () => {
		await startServer();
	});
}
