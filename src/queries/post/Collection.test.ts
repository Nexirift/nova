import { faker } from '@faker-js/faker';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../drizzle/db';
import { postCollection } from '../../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

// Helper function to create a post collection in the database
async function createPostCollection(
	id: string,
	userId: string,
	visibility: 'PUBLIC' | 'PRIVATE'
) {
	await db.insert(postCollection).values({
		id,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility,
		userId
	});
}

// Helper function to remove a post collection from the database
async function removePostCollection(id: string) {
	await db.delete(postCollection).where(eq(postCollection.id, id));
}

// Test for unauthenticated request to get a non-existing post collection
test('Unauthenticated | Collections - It should get a non-existing post collection', async () => {
	const nonExistingPostCollection = faker.string.uuid();

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(`
		query {
			getPostCollection(id: "${nonExistingPostCollection}") {
				id
				name
			}
		}
	`);

	// Expect the getPost data to be empty (null).
	expect(data).toHaveProperty('data.getPostCollection', null);
});

const types = ['PUBLIC', 'PRIVATE'];

for (const type of types) {
	// Test for authenticated request to get an existing post collection
	test(`Authenticated | Collections - It should get an existing post collection (${type})`, async () => {
		const existingPostCollection = faker.string.uuid();
		const user1 = faker.string.uuid();

		// Insert our fake user into the database.
		await createUser({ sub: user1 });

		// Insert our fake post into the database.
		await createPostCollection(
			existingPostCollection,
			user1,
			type as 'PUBLIC' | 'PRIVATE'
		);

		// Make the GraphQL request to the getPost endpoint.
		const data = await makeGQLRequest(`
			query {
				getPostCollection(id: "${existingPostCollection}") {
					id
					name
					description
					visibility
				}
			}
		`);

		// Expect the ID to be the same as what was created in the database.
		expect(data).toHaveProperty(
			'data.getPostCollection.id',
			existingPostCollection
		);
		expect(data).toHaveProperty(
			'data.getPostCollection.name',
			'Test Collection'
		);
		expect(data).toHaveProperty(
			'data.getPostCollection.description',
			'This is a collection for testing purposes.'
		);
		expect(data).toHaveProperty('data.getPostCollection.visibility', type);

		// Remove that test post from the database for future tests.
		await removePostCollection(existingPostCollection);

		// Remove that test user from the database for future tests.
		await removeUser(user1);
	});
}
