import { faker } from '@faker-js/faker';
import { expect, test } from 'bun:test';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';
import { tokenClient } from '../../redis';

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
	expect(data.errors[0]).toHaveProperty('message', 'User not found.');
	expect(data.errors[0].extensions).toHaveProperty('code', 'USER_NOT_FOUND');
});

test('Unauthenticated | General - It should get an existing user', async () => {
	const existingUser = faker.string.uuid();

	// Create our fake user.
	await createUser({ sub: existingUser });

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

test('Authenticated | General - It should check the me endpoint (Synced)', async () => {
	const me = faker.string.uuid();

	// Create our fake user.
	await createUser({ sub: me });

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

test('Authenticated | General - It should check the me endpoint (Not Synced)', async () => {
	const me = faker.string.uuid();

	// Create our fake token.
	await tokenClient.set(`tokens:${me}`, JSON.stringify({ id: me }));

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

	// Expect an error indicating the user has not been synced to the database yet.
	expect(data.errors[0]).toHaveProperty(
		'message',
		'The user has not been synced to the database yet.'
	);
	expect(data.errors[0].extensions).toHaveProperty('code', 'USER_NOT_SYNCED');

	// Clean up all of the testing data.
	await removeUser(me);
});
