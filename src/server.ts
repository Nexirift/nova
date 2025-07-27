import { readFileSync } from 'fs';
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { db, migrator, prodDbClient, user } from '@nexirift/db';
import { authorize, useBetterAuth } from '@nexirift/plugin-better-auth';
import { beforeAll } from 'bun:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import gradient from 'gradient-string';
import { makeHandler } from 'graphql-ws/dist/use/@fastify/websocket';
import { createYoga, useReadinessCheck } from 'graphql-yoga';
import { version } from '../package.json';
import { config } from './config';
import type { Context } from './context';
import { env } from './env';
import getGitCommitHash from './git';
import { enableAll } from './lib/logger';
import { isTestMode, mediaUploadEndpoint } from './lib/server';
import { pubsub } from './pubsub';
import { redisClient, tokenClient } from './redis';
import { schema } from './schema';

export const rootHtml = readFileSync('./static/root.html', 'utf8');
export const notFoundHtml = readFileSync('./static/404.html', 'utf8');

// Create a new instance of GraphQL Yoga with the schema and plugins.
const yoga = createYoga<{
	req: FastifyRequest;
	reply: FastifyReply;
}>({
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
		}),
		useResponseCache({
			session: (request) => request.headers.get('authorization'),
			ttl: 5_000,
			scopePerSchemaCoordinate: {
				'Query.me': 'PRIVATE'
			}
		})
	],
	landingPage: ({ url, fetchAPI }) => {
		const _notFound = notFoundHtml.replace(
			'{SERVER_ADDRESS}',
			url.hostname
		);

		return new fetchAPI.Response(_notFound, {
			status: 404,
			headers: {
				'Content-Type': 'text/html; charset=utf-8'
			}
		});
	},
	// Integrate Fastify logger
	logging: {
		debug: (...args) => args.forEach((arg) => console.debug(arg)),
		info: (...args) => args.forEach((arg) => console.info(arg)),
		warn: (...args) => args.forEach((arg) => console.warn(arg)),
		error: (...args) => args.forEach((arg) => console.error(arg))
	}
});

export async function startServer() {
	const port = isTestMode ? 25447 : (env.PORT ?? 3000);
	const fastify = Fastify({
		logger: true
	});

	// Register WebSocket support
	await fastify.register(fastifyWebsocket, {
		options: { maxPayload: 1048576 }
	});

	// Handle root path for GET requests
	fastify.get('/', (request, reply) => {
		const _root = rootHtml.replace('{SERVER_ADDRESS}', request.hostname);
		reply.type('text/html; charset=utf-8').send(_root);
	});

	// Handle upload endpoint
	fastify.all('/upload', async (request: FastifyRequest, reply) => {
		const response = await mediaUploadEndpoint(request);
		const body = await response.text();
		reply
			.code(response.status)
			.headers(Object.fromEntries(response.headers.entries()))
			.send(body);
	});

	// Register GraphQL endpoint
	fastify.route({
		url: yoga.graphqlEndpoint,
		method: ['POST', 'OPTIONS'],
		handler: (request, reply) =>
			yoga.handleNodeRequestAndResponse(request, reply, {
				req: request,
				reply
			})
	});

	// Set up WebSockets for GraphQL subscriptions
	fastify.register(async (fastify) => {
		fastify.get(
			'/ws',
			{ websocket: true },
			(connection: WebSocket, request) => {
				const authHeader = request.headers.authorization;

				makeHandler(
					{
						schema,
						context: async () => {
							if (authHeader) {
								const auth = await authorize(
									config.auth,
									authHeader.split(' ')[1]!
								);
								const authString = JSON.stringify(auth);
								try {
									return {
										auth,
										pubsub
									} as Context;
								} catch {
									connection.socket.send(
										JSON.stringify({
											type: 'error',
											payload: { message: authString }
										})
									);
									connection.socket.close();
								}
							} else {
								return { pubsub } as Context;
							}
						}
					},
					connection.socket
				);
			}
		);
	});

	// Connect to Redis.
	try {
		await redisClient.connect();
		await tokenClient.connect();
	} catch (err) {
		console.error(err);
	}

	if (!isTestMode) {
		// Connect to the database.
		await prodDbClient.connect();
	} else {
		// Migrate the database.
		await migrator();
	}

	// Start the server
	await fastify.listen({
		port,
		host: '0.0.0.0'
	});

	const address = fastify.server.address();
	const hostname = typeof address === 'string' ? address : '0.0.0.0';
	const serverPort =
		typeof address === 'string' ? port : address?.port || port;

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
		const authServer = new URL(env.BETTER_AUTH_URL!);
		console.log(
			`🔑 Authentication Server: ${authServer.hostname}${authServer.port && ':' + authServer.port}`
		);
	} else {
		console.log('🔑 Authentication Server: Test Mode');
	}
	console.log('🧰 Configuration File:', config.file);
	console.log(
		`🌐 Serving HTTP at ${new URL(`http://${hostname}:${serverPort}`)}`
	);
	console.log(
		`🔌 Serving WS at ${new URL(`ws://${hostname}:${serverPort}/ws`)}`
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
