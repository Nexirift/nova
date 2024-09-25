import { expect, test, beforeAll } from 'bun:test';
import { startServer } from '../../server';
import { fetch } from 'bun';
import { db } from '../../drizzle/db';
import { user } from '../../drizzle/schema';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { makeGQLRequest } from '../../lib/tests';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
	await startServer();
});

test('unauthenticated | get non-existing user', async () => {
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "TEST_ID-DDDDD-EEEEE-FFFFF") {
                        id
                        username
                    }
                }
            `);

	expect(data).toHaveProperty('data.getUser', null);
});

test('unauthenticated | get existing user', async () => {
	await db.insert(user).values({
		id: 'TEST_ID-AAAAA-BBBBB-CCCCC',
		username: 'test'
	});

	const data = await makeGQLRequest(`
                query {
                    getUser(id: "TEST_ID-AAAAA-BBBBB-CCCCC") {
                        id
                        username
                    }
                }
            `);

	expect(data).toHaveProperty('data.getUser.id', 'TEST_ID-AAAAA-BBBBB-CCCCC');

	// cleanup
	await db.delete(user).where(eq(user.id, 'TEST_ID-AAAAA-BBBBB-CCCCC'));
});
