import { OIDCToken, useOIDC } from '@nexirift/plugin-oidc';
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
import { authorize } from './lib/authentication';
import { Context } from './context';

// Create a new instance of GraphQL Yoga with the schema and plugins.
const yoga = createYoga({
	schema: schema,
	graphiql: false,
	graphqlEndpoint: '/',
	plugins: [useOIDC(Config.OpenID)]
});

export async function startServer() {
	const server = Bun.serve({
		async fetch(req, server) {
			// Determine whether or not the user is trying to access websockets.
			// This probably isn't perfect but i don't know any other ways to do this.
			if (
				req.headers.get('sec-websocket-protocol') ||
				req.headers.get('sec-websocket-version') ||
				req.headers.get('sec-websocket-key') ||
				req.headers.get('sec-websocket-extensions') ||
				req.headers.get('upgrade') === 'websocket' ||
				req.headers.get('connection') === 'upgrade'
			) {
				// Require websockets to be upgraded.
				if (req.headers.get('upgrade') != 'websocket') {
					return new Response('Upgrade Required', {
						status: 426
					});
				}
				// Require the protocol to be valid.
				if (
					!handleProtocols(
						req.headers.get('sec-websocket-protocol') || ''
					)
				) {
					return new Response('Bad Request', { status: 404 });
				}
				// Upgrade the connection.
				// This function uses a hacky way to pass the Authorization header.
				// Hopefully, Bun will provide the full request object in the future.
				if (
					!server.upgrade(req, {
						data: req.headers.get('authorization')
					})
				) {
					return new Response('Internal Server Error', {
						status: 500
					});
				}
			} else {
				const url = new URL(req.url);
				if (url.pathname === '/upload') {
					// TODO: Remove this and use event notifications instead.
					// We are waiting on the Backblaze B2 team to allow us.
					return mediaUploadEndpoint(req);
				} else if (url.pathname.startsWith('/webhook/')) {
					// Handle webhooks.
					return webhookEndpoint(req);
				} else if (url.pathname === '/health') {
					// Health check endpoint.
					return new Response('OK', { status: 200 });
				} else {
					// Let the GraphQL server handle the rest.
					return yoga.fetch(req);
				}
			}
		},
		websocket: makeHandler({
			schema,
			context: async (ctx) => {
				if (ctx.extra.socket.data) {
					const checkAuth = await authorize(
						Config.OpenID,
						(ctx.extra.socket.data! as string).split(' ')[1]
					);
					try {
						return {
							oidc: JSON.parse(checkAuth!) as OIDCToken,
							pubsub
						} as Context;
					} catch (e) {
						ctx.extra.socket.send(
							JSON.stringify({
								type: 'pong',
								payload: { message: checkAuth! }
							})
						);
						ctx.extra.socket.close(3003, checkAuth);
					}
				} else {
					return { pubsub } as Context;
				}
			}
		}),
		port: isTestMode ? 25447 : Bun.env.PORT ?? 3000,
		development: !!(Bun.env.NODE_ENV === 'development') || isTestMode
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
		gradient(['yellow', 'cyan']).multiline(
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
				new URL(Bun.env.AUTH_INTROSPECT_URL!).hostname
			}`
		);
	} else {
		console.log('🔑 Authentication Server: Test Mode');
	}
	console.log(
		`🌐 Serving HTTP at ${new URL(
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
}

if (!isTestMode) {
	startServer();
} else {
	beforeAll(async () => {
		await startServer();
	});
}
