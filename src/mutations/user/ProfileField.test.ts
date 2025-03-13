import { faker } from '@faker-js/faker';
import { db, userProfileField } from '@nexirift/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const createProfileFieldMutation = (name: string, value: string) => `
	mutation {
		createProfileField(name: "${name}", value: "${value}") {
			name
			value
		}
	}
`;

const updateProfileFieldMutation = (
	name: string,
	newName: string,
	newValue: string
) => `
	mutation {
		updateProfileField(name: "${name}", newName: "${newName}", newValue: "${newValue}") {
			name
			value
		}
	}
`;

const setupUser = async () => {
	const user1 = faker.string.uuid();
	await createUser({ sub: user1 });
	return user1;
};

const teardownUser = async (user1: string) => {
	await db.delete(userProfileField).where(eq(userProfileField.userId, user1));
	await removeUser(user1);
};

test('Authenticated | Profile Fields - It should create a profile field', async () => {
	const fieldName = faker.lorem.words(2);
	const fieldValue = faker.lorem.words(4);
	const user1 = await setupUser();

	const data = await makeGQLRequest(
		createProfileFieldMutation(fieldName, fieldValue),
		user1
	);

	expect(data).toHaveProperty('data.createProfileField.name', fieldName);
	expect(data).toHaveProperty('data.createProfileField.value', fieldValue);

	await teardownUser(user1);
});

test('Authenticated | Profile Fields - It should update a profile field', async () => {
	const fieldName = faker.lorem.words(2);
	const fieldValue = faker.lorem.words(4);
	const newFieldName = faker.lorem.words(3);
	const newFieldValue = faker.lorem.words(5);
	const user1 = await setupUser();

	await db
		.insert(userProfileField)
		.values({ name: fieldName, value: fieldValue, userId: user1 });

	const data = await makeGQLRequest(
		updateProfileFieldMutation(fieldName, newFieldName, newFieldValue),
		user1
	);

	expect(data).toHaveProperty('data.updateProfileField.name', newFieldName);
	expect(data).toHaveProperty('data.updateProfileField.value', newFieldValue);

	await teardownUser(user1);
});

test('Authenticated | Profile Fields - It should fail if the profile field does not exist', async () => {
	const user1 = await setupUser();

	const data = await makeGQLRequest(
		updateProfileFieldMutation('test', 'new_test', 'new_value'),
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'There is no profile field with the given name'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'PROFILE_FIELD_NOT_FOUND'
	);

	await teardownUser(user1);
});

test('Authenticated | Profile Fields - It should fail if the profile field already exists', async () => {
	const user1 = await setupUser();

	await db
		.insert(userProfileField)
		.values({ name: 'test', value: 'value', userId: user1 });

	const data = await makeGQLRequest(
		createProfileFieldMutation('test', 'value'),
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Profile field with the same name already exists'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'PROFILE_FIELD_ALREADY_EXISTS'
	);

	await teardownUser(user1);
});

test('Authenticated | Profile Fields - It should fail if the profile field already exists for update', async () => {
	const user1 = await setupUser();

	await db
		.insert(userProfileField)
		.values({ name: 'test', value: 'value', userId: user1 });
	await db
		.insert(userProfileField)
		.values({ name: 'test2', value: 'value', userId: user1 });

	const data = await makeGQLRequest(
		updateProfileFieldMutation('test', 'test2', 'new_value'),
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Profile field with the same name already exists'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'PROFILE_FIELD_ALREADY_EXISTS'
	);

	await teardownUser(user1);
});
