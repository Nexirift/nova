import { faker } from '@faker-js/faker';
import { config } from '../config';
import { db } from '@nexirift/db';
import { user } from '@nexirift/db';
import { tokenClient } from '../redis';
import { eq } from 'drizzle-orm';

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
	const generatedUsername =
		data.preferred_username ?? faker.internet.username();

	const userdb = await db
		.insert(user)
		.values({
			id: data.sub,
			username: generatedUsername.toLowerCase(),
			displayUsername: generatedUsername,
			email: data.email ?? faker.internet.email(),
			emailVerified: true,
			type: data.type ?? 'PUBLIC',
			birthday: faker.date.birthdate().toISOString()
		})
		.returning()
		.execute();

	await tokenClient.set(
		`${config.auth.cachePrefix}:${data.sub}`,
		JSON.stringify({ user: userdb[0] })
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

	return tokenClient.del(`${config.auth.cachePrefix}:${sub}`);
}
