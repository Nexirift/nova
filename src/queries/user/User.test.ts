import { expect, test, beforeAll } from 'bun:test';
import { startServer } from '../../server';
import { fetch } from 'bun';
import { db } from '../../drizzle/db';
import { user } from '../../drizzle/schema';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createToken, makeGQLRequest } from '../../lib/tests';
import { eq } from 'drizzle-orm';
import { tokenClient } from '../../redis';

beforeAll(async () => {
	await startServer();
});

test('unauthenticated | get non-existing user', async () => {
	// Make the GraphQL request to the getUser endpoint.
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "TEST_ID-DDDDD-EEEEE-FFFFF") {
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
		id: 'TEST_ID-AAAAA-BBBBB-CCCCC',
		username: 'test'
	});

	// Make the GraphQL request to the getUser endpoint.
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "TEST_ID-AAAAA-BBBBB-CCCCC") {
                        id
                        username
                    }
                }
            `);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.getUser.id', 'TEST_ID-AAAAA-BBBBB-CCCCC');

	// Remove that test user from the database for future tests.
	await db.delete(user).where(eq(user.id, 'TEST_ID-AAAAA-BBBBB-CCCCC'));
});

test('authenticated | check me endpoint', async () => {
	// Let's create a fake token with a user (TEST_1).
	await createToken({
		sub: 'TEST_1',
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
		'TEST_1' // This is the name of our token.
	);

	// Expect the ID to be the same as what was generated.
	expect(data).toHaveProperty('data.me.id', 'TEST_1');
});
