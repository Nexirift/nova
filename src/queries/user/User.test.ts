import { faker } from '@faker-js/faker';
import { expect, test } from 'bun:test';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const getUserQuery = (id: string) => `
	query {
		getUser(id: "${id}") {
			id
			username
		}
	}
`;

const meQuery = `
	query {
		me {
			id
			username
		}
	}
`;

const expectError = (
	data: { errors: { message: string; extensions: { code: string } }[] },
	message: string,
	code: string
) => {
	expect(data.errors[0]).toHaveProperty('message', message);
	expect(data.errors[0]?.extensions).toHaveProperty('code', code);
};

test('Unauthenticated | General - It should get a non-existing user', async () => {
	const nonExistingUser = faker.string.uuid();

	const data = await makeGQLRequest(getUserQuery(nonExistingUser));

	expect(data).toHaveProperty('data.getUser', null);
	expectError(data, 'User not found.', 'USER_NOT_FOUND');
});

test('Unauthenticated | General - It should get an existing user', async () => {
	const existingUser = faker.string.uuid();

	await createUser({ sub: existingUser });

	const data = await makeGQLRequest(getUserQuery(existingUser));

	expect(data).toHaveProperty('data.getUser.id', existingUser);

	await removeUser(existingUser);
});

test('Authenticated | General - It should check the me endpoint', async () => {
	const me = faker.string.uuid();

	await createUser({ sub: me });

	const data = await makeGQLRequest(meQuery, me);

	expect(data).toHaveProperty('data.me.id', me);

	await removeUser(me);
});
