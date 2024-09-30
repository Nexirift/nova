import { expect, test } from 'bun:test';
import { db } from '../drizzle/db';
import { user, userRelationship } from '../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../lib/tests';
import { and, eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';

test('Unauthenticated | General - It should get a non-existing user', async () => {
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

test('Unauthenticated | General - It should get an existing user', async () => {
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

test('Authenticated | General - It should check the me endpoint', async () => {
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

const types = ['block', 'mute', 'follow', 'request'];

for (const type of types) {
	const _type = type === 'request' ? 'follow' : type;

	test(`Authenticated | Relationships - It should check ${type}s`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		// Create our two fake users efficiently
		await Promise.all([
			createUser({ sub: user1 }),
			createUser({
				sub: user2,
				type: type === 'request' ? 'PRIVATE' : 'PUBLIC'
			})
		]);

		// Make the GraphQL request to the block endpoint
		const data = await makeGQLRequest(
			`
                mutation {
                    ${_type}User(id: "${user2}") {
                        type
                    }
                }
            `,
			user1
		);

		// Check for the expected type
		expect(data).toHaveProperty(
			`data.${_type}User.type`,
			type === 'request' ? 'REQUEST' : type.toUpperCase()
		);

		// Make the GraphQL request to the unblock endpoint
		const undoneData = await makeGQLRequest(
			`
                mutation {
                    un${_type}User(id: "${user2}") {
                        type
                    }
                }
            `,
			user1
		);

		// Check for the expected type after unblocking
		expect(undoneData).toHaveProperty(
			`data.un${_type}User.type`,
			type === 'request' ? 'REQUEST' : type.toUpperCase()
		);

		// Clean up all of the testing data
		await Promise.all([removeUser(user1), removeUser(user2)]);
	});
}

for (const type of ['accept', 'deny']) {
	test(`Authenticated | Relationships - It should ${type} a follow request`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		// Create our two fake users efficiently
		await Promise.all([
			createUser({ sub: user1 }),
			createUser({
				sub: user2,
				type: 'PRIVATE'
			})
		]);

		// Make the GraphQL request to the block endpoint
		const data = await makeGQLRequest(
			`
                mutation {
                    followUser(id: "${user2}") {
                        type
                    }
                }
            `,
			user1
		);

		// Check for the expected type
		expect(data).toHaveProperty(`data.followUser.type`, 'REQUEST');

		// Make the GraphQL request to the unblock endpoint
		const undoneData = await makeGQLRequest(
			`
                mutation {
                    ${type}FollowRequest(id: "${user1}") {
                        type
                    }
                }
            `,
			user2
		);

		// Check for the expected type after unblocking
		expect(undoneData).toHaveProperty(
			`data.${type}FollowRequest.type`,
			type === 'accept' ? 'FOLLOW' : 'REQUEST'
		);

		// Clean up all of the testing data
		await Promise.all([removeUser(user1), removeUser(user2)]);
	});
}
