import { expect, test } from 'bun:test';
import { db } from '../drizzle/db';
import { user, userRelationship } from '../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../lib/tests';
import { and, eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';

test('unauthenticated | get non-existing user', async () => {
	const nonExistingUser = faker.string.uuid();

	// Make the GraphQL request to the getUser endpoint.
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "${nonExistingUser}") {
                        id
                        username
                    }
                }
            `);

	// Expect the getUser data to be empty (null).
	expect(data).toHaveProperty('data.getUser', null);
});

test('unauthenticated | get existing user', async () => {
	const existingUser = faker.string.uuid();

	// Create our fake user.
	await createUser({
		sub: existingUser
	});

	// Make the GraphQL request to the getUser endpoint.
	const data = await makeGQLRequest(`
                query {
                    getUser(id: "${existingUser}") {
                        id
                        username
                    }
                }
            `);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.getUser.id', existingUser);

	// Clean up all of the testing data.
	await removeUser(existingUser);
});

test('authenticated | check me endpoint', async () => {
	const me = faker.string.uuid();

	// Create our fake user.
	await createUser({
		sub: me
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
		me
	);

	// Expect the ID to be the same as what was generated.
	expect(data).toHaveProperty('data.me.id', me);

	// Clean up all of the testing data.
	await removeUser(me);
});

test('authenticated | check blocks', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	// Create our two fake users.
	await createUser({
		sub: user1
	});

	await createUser({
		sub: user2
	});

	// TODO: Use real endpoint when implemented.
	await db.insert(userRelationship).values({
		fromId: user1,
		toId: user2,
		type: 'BLOCK'
	});

	// Make the GraphQL request to the me endpoint.
	const data = await makeGQLRequest(
		`
                query {
                    getUser(id: "${user1}") {
                        id
                        username
						isBlocked
                    }
                }
            `,
		user2
	);

	// Expect the ID to be the same as what was generated.
	expect(data).toHaveProperty('data.getUser.isBlocked', true);

	// Clean up all of the testing data.
	await db
		.delete(userRelationship)
		.where(
			and(
				eq(userRelationship.fromId, user1),
				eq(userRelationship.toId, user2)
			)
		);

	await removeUser(user1);
	await removeUser(user2);
});
