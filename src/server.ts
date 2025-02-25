import { beforeAll } from 'bun:test';
import gradient from 'gradient-string';
import { handleProtocols, makeHandler } from 'graphql-ws/lib/use/bun';
import { createYoga, useReadinessCheck } from 'graphql-yoga';
import { version } from '../package.json';
import { config, stripe } from './config';
import { type Context } from './context';
import { db, migrator, prodDbClient, user } from '@nexirift/db';
import getGitCommitHash from './git';
import { enableAll } from './lib/logger';
import { isTestMode, mediaUploadEndpoint, webhookEndpoint } from './lib/server';
import { pubsub } from './pubsub';
import { redisClient, tokenClient } from './redis';
import { schema } from './schema';
import { authorize, useBetterAuth } from '@nexirift/plugin-better-auth';

// Create a new instance of GraphQL Yoga with the schema and plugins.
const yoga = createYoga({
	schema: schema,
	graphiql: false,
	maskedErrors: false,
	graphqlEndpoint: '/',
	plugins: [
		useBetterAuth(config.auth),
		useReadinessCheck({
			endpoint: '/ready',
			check: async () => {
				try {
					return db.$count(user) != null;
				} catch (err) {
					console.error(err);
					return false;
				}
			}
		})
	]
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
					const auth = await authorize(
						config.auth,
						(ctx.extra.socket.data! as string).split(' ')[1]
					);
					const authString = JSON.stringify(auth);
					try {
						return {
							auth,
							pubsub
						} as Context;
					} catch (e) {
						ctx.extra.socket.send(
							JSON.stringify({
								type: 'pong',
								payload: { message: authString }
							})
						);
						ctx.extra.socket.close(3003, authString);
					}
				} else {
					return { pubsub } as Context;
				}
			}
		}),
		port: isTestMode ? 25447 : (Bun.env.PORT ?? 3000),
		development: !!(Bun.env.NODE_ENV === 'development') || isTestMode
	});

	// Connect to Redis.
	await redisClient.connect();
	await tokenClient.connect();

	if (!isTestMode) {
		// Connect to the database.
		await prodDbClient.connect();
	} else {
		// Migrate the database.
		await migrator();
	}

	// Log the server information to the console.
	console.log('');
	console.log(
		gradient(['orange', 'cyan']).multiline(
			[
				'███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ',
				'████╗  ██║██╔═══██╗██║   ██║██╔══██╗',
				'██╔██╗ ██║██║   ██║██║   ██║███████║',
				'██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║',
				'██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║',
				'╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝'
			].join('\n')
		)
	);
	console.log('\x1b[36m');
	console.log(`🌌 Nexirift Nova API v${version} (${getGitCommitHash()})`);
	if (!isTestMode) {
		console.log(
			`🔑 Authentication Server: ${
				new URL(Bun.env.AUTH_INTROSPECT_URL!).hostname
			}`
		);
	} else {
		console.log('🔑 Authentication Server: Test Mode');
	}
	console.log('🧰 Configuration File:', config.file);
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

	if (Bun.env.STRIPE_SECRET_KEY) {
		if (
			server.hostname === 'localhost' ||
			server.hostname === '127.0.0.1'
		) {
			console.log(
				`💳 Stripe requires CLI for webhooks due to the hostname being ${server.hostname}.`
			);
		} else {
			await stripe.webhookEndpoints.create({
				enabled_events: ['charge.succeeded', 'charge.failed'],
				url: new URL(
					`/webhook/${Bun.env.WEBHOOK_STRIPE}`,
					`http://${server.hostname}:${server.port}`
				).toString()
			});
		}
	}
}

if (!isTestMode) {
	startServer();
} else {
	beforeAll(async () => {
		await startServer();
	});
}
