import { expect, test } from 'bun:test';
import { db } from '../drizzle/db';
import { user } from '../drizzle/schema';
import { createToken, makeGQLRequest } from '../lib/tests';
import { eq } from 'drizzle-orm';

test('unauthenticated | get non-existing user', async () => {
	// Make the GraphQL request to the getUser endpoint.
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "254afcf6c19c4979a0231ac579499cf0") {
                        id
                        username
                    }
                }
            `);

	// Expect the getUser data to be empty (null).
	expect(data).toHaveProperty('data.getUser', null);
});

test('unauthenticated | get existing user', async () => {
	// Insert our fake user into the database.
	await db.insert(user).values({
		id: '254afcf6c19c4979a0231ac579499cf0',
		username: 'test'
	});

	// Make the GraphQL request to the getUser endpoint.
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "254afcf6c19c4979a0231ac579499cf0") {
                        id
                        username
                    }
                }
            `);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty(
		'data.getUser.id',
		'254afcf6c19c4979a0231ac579499cf0'
	);

	// Remove that test user from the database for future tests.
	await db
		.delete(user)
		.where(eq(user.id, '254afcf6c19c4979a0231ac579499cf0'));
});

test('authenticated | check me endpoint', async () => {
	// Let's create a fake token with a user (XFQVTJLLQTQXZETDFBAJGWSC).
	await createToken({
		sub: 'XFQVTJLLQTQXZETDFBAJGWSC',
		email: 'test1@spark.local',
		preferred_username: 'Test 1',
		avatar: 'https://auth.nexirift.com/media/default.png'
	});

	// Make the GraphQL request to the me endpoint.
	const data = await makeGQLRequest(
		`
                query {
                    me {
                        id
                        username
                    }
                }
            `,
		'XFQVTJLLQTQXZETDFBAJGWSC' // This is the name of our token.
	);

	// Expect the ID to be the same as what was generated.
	expect(data).toHaveProperty('data.me.id', 'XFQVTJLLQTQXZETDFBAJGWSC');
});
