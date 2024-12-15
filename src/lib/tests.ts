import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../drizzle/db';
import { user } from '../drizzle/schema';
import { tokenClient } from '../redis';

/**
 * Allows communication with the GraphQL API in testing mode.
 * @param query The GraphQL query to send to the server.
 * @param token The token to send with the request.
 * @returns A JSON response for the GraphQL query.
 */
export async function makeGQLRequest(query: string, token?: string) {
	const fetcher = await fetch('http://localhost:25447', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			Authorization: token ? `Bearer ${token}` : ''
		},
		body: JSON.stringify({
			query: query
		})
	});

	const res = await fetcher.json();

	return res;
}

/**
 * Creating fake users & tokens for testing.
 * @param data A JSON object containing the token data.
 * @returns A Redis response for the token.
 */
export async function createUser(data: {
	sub: string;
	email?: string;
	preferred_username?: string;
	type?: 'PUBLIC' | 'PRIVATE';
}) {
	const userdb = await db
		.insert(user)
		.values({
			id: data.sub,
			username: data.preferred_username ?? faker.internet.username(),
			email: data.email! ?? faker.internet.email(),
			type: data.type ?? 'PUBLIC'
		})
		.returning()
		.execute();

	await tokenClient.set(
		`${config.openid.cachePrefix}:${data.sub}`,
		JSON.stringify(data)
	);

	return userdb[0];
}

/**
 * Removing fake users & tokens for testing.
 * @param sub The sub of the token to remove.
 * @returns A Redis response for the token.
 */
export async function removeUser(sub: string) {
	await db.delete(user).where(eq(user.id, sub));

	return tokenClient.del(`${config.openid.cachePrefix}:${sub}`);
}
