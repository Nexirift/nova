import { faker } from '@faker-js/faker';
import { expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { db } from '../../drizzle/db';
import { userProfileField } from '../../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

test('Authenticated | Profile Fields - It should create a profile field', async () => {
	const fieldName = faker.lorem.words(2);
	const fieldValue = faker.lorem.words(4);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    createProfileField(name: "${fieldName}", value: "${fieldValue}") {
                        name
                        value
                    }
                }
            `,
		user1
	);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.createProfileField.name', fieldName);
	expect(data).toHaveProperty('data.createProfileField.value', fieldValue);

	// Remove that test post from the database for future tests.
	await db
		.delete(userProfileField)
		.where(
			and(
				eq(userProfileField.name, data.data.createProfileField.name),
				eq(userProfileField.userId, user1)
			)
		);

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | Profile Fields - It should update a profile field', async () => {
	const fieldName = faker.lorem.words(2);
	const fieldValue = faker.lorem.words(4);
	const newFieldName = faker.lorem.words(3);
	const newFieldValue = faker.lorem.words(5);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	await db.insert(userProfileField).values({
		name: fieldName,
		value: fieldValue,
		userId: user1
	});

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    updateProfileField(name: "${fieldName}", newName: "${newFieldName}", newValue: "${newFieldValue}") {
                        name
                        value
                    }
                }
            `,
		user1
	);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.updateProfileField.name', newFieldName);
	expect(data).toHaveProperty('data.updateProfileField.value', newFieldValue);

	// Remove that test post from the database for future tests.
	await db
		.delete(userProfileField)
		.where(
			and(
				eq(userProfileField.name, data.data.updateProfileField.name),
				eq(userProfileField.userId, user1)
			)
		);

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});
