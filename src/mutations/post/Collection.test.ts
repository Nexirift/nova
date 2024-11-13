import { faker } from '@faker-js/faker';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../drizzle/db';
import { post, postCollection, postCollectionItem } from '../../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const types = ['PUBLIC', 'PRIVATE'];

// Loop through each type (PUBLIC and PRIVATE) to test creating a new post collection
for (const type of types) {
	test(`Authenticated | General - It should create a new post collection (${type})`, async () => {
		const postCollectionName = faker.lorem.words(5);
		const postCollectionDescription = faker.lorem.words(10);
		const user1 = faker.string.uuid();

		// Insert our fake user into the database.
		await createUser({
			sub: user1
		});

		// Make the GraphQL request to the createPostCollection endpoint.
		const data = await makeGQLRequest(
			`
                mutation {
                    createPostCollection(name: "${postCollectionName}", description: "${postCollectionDescription}", visibility: "${type}") {
                        id
                        name
                        description
                        visibility
                    }
                }
            `,
			user1
		);

		// Validate the response data
		expect(data).toHaveProperty(
			'data.createPostCollection.name',
			postCollectionName
		);
		expect(data).toHaveProperty(
			'data.createPostCollection.description',
			postCollectionDescription
		);
		expect(data).toHaveProperty(
			'data.createPostCollection.visibility',
			type
		);

		// Remove the test post collection from the database for future tests.
		await db
			.delete(postCollection)
			.where(eq(postCollection.id, data.data.createPostCollection.id));

		// Remove the test user from the database for future tests.
		await removeUser(user1);
	});
}

// Loop through each type (PUBLIC and PRIVATE) to test updating an existing post collection
for (const type of types) {
	test(`Authenticated | General - It should update an existing post collection (${
		type === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
	} to ${type})`, async () => {
		const existingPostCollection = faker.string.uuid();
		const postCollectionName = faker.lorem.words(5);
		const postCollectionDescription = faker.lorem.words(10);
		const user1 = faker.string.uuid();

		// Insert our fake user into the database.
		await createUser({
			sub: user1
		});

		// Insert our fake post collection into the database.
		await db.insert(postCollection).values({
			id: existingPostCollection,
			name: postCollectionName,
			description: postCollectionDescription,
			visibility: type === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC',
			userId: user1
		});

		// Make the GraphQL request to the updatePostCollection endpoint.
		const data = await makeGQLRequest(
			`
                mutation {
                    updatePostCollection(id: "${existingPostCollection}", name: "Test Collection", description: "This is a test collection.", visibility: "${type}") {
                        id
                        name
                        description
                        visibility
                    }
                }
            `,
			user1
		);

		// Validate the response data
		expect(data).toHaveProperty(
			'data.updatePostCollection.id',
			existingPostCollection
		);
		expect(data).toHaveProperty(
			'data.updatePostCollection.name',
			'Test Collection'
		);
		expect(data).toHaveProperty(
			'data.updatePostCollection.description',
			'This is a test collection.'
		);
		expect(data).toHaveProperty(
			'data.updatePostCollection.visibility',
			type
		);

		// Remove the test post collection from the database for future tests.
		await db
			.delete(postCollection)
			.where(eq(postCollection.id, existingPostCollection));

		// Remove the test user from the database for future tests.
		await removeUser(user1);
	});
}

// Test deleting an existing post collection
test('Authenticated | General - It should delete an existing post collection', async () => {
	const existingPostCollection = faker.string.uuid();
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Insert our fake post collection into the database.
	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	// Make the GraphQL request to the deletePostCollection endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    deletePostCollection(id: "${existingPostCollection}")
                }
            `,
		user1
	);

	// Validate the response data
	expect(data).toHaveProperty('data.deletePostCollection', true);

	// Remove the test post collection from the database for future tests.
	await db
		.delete(postCollection)
		.where(eq(postCollection.id, existingPostCollection));

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});

// Test adding a post to a collection
test('Authenticated | General - It should add a post to a collection', async () => {
	const existingPostCollection = faker.string.uuid();
	const existingPost = faker.string.uuid();
	const postContent = faker.lorem.words(10);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Insert our fake post collection into the database.
	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1
	});

	// Make the GraphQL request to the addPostToCollection endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    addPostToCollection(id: "${existingPostCollection}", postId: "${existingPost}") {
                        post {
                            id
                            content
                        }
                        collection {
                            id
                            name
                            description
                            visibility
                        }
                    }
                }
            `,
		user1
	);

	// Validate the response data
	expect(data).toHaveProperty(
		'data.addPostToCollection.post.id',
		existingPost
	);
	expect(data).toHaveProperty(
		'data.addPostToCollection.post.content',
		'test'
	);
	expect(data).toHaveProperty(
		'data.addPostToCollection.collection.id',
		existingPostCollection
	);
	expect(data).toHaveProperty(
		'data.addPostToCollection.collection.name',
		'Test Collection'
	);
	expect(data).toHaveProperty(
		'data.addPostToCollection.collection.description',
		'This is a collection for testing purposes.'
	);
	expect(data).toHaveProperty(
		'data.addPostToCollection.collection.visibility',
		'PUBLIC'
	);

	// Remove the test post from the database for future tests.
	await db
		.delete(postCollectionItem)
		.where(
			eq(postCollectionItem.postId, data.data.addPostToCollection.post.id)
		);

	// Remove the test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove the test post collection from the database for future tests.
	await db
		.delete(postCollection)
		.where(eq(postCollection.id, existingPostCollection));

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});

// Test removing a post from a collection
test('Authenticated | General - It should remove a post from a collection', async () => {
	const existingPostCollection = faker.string.uuid();
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Insert our fake post collection into the database.
	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1
	});

	// Insert the post into the post collection item table
	await db.insert(postCollectionItem).values({
		collectionId: existingPostCollection,
		postId: existingPost
	});

	// Make the GraphQL request to the removePostFromCollection endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    removePostFromCollection(id: "${existingPostCollection}", postId: "${existingPost}") 
                }
            `,
		user1
	);

	// Validate the response data
	expect(data).toHaveProperty('data.removePostFromCollection', true);

	// Remove the test post from the database for future tests.
	await db
		.delete(postCollectionItem)
		.where(eq(postCollectionItem.postId, existingPost));

	// Remove the test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove the test post collection from the database for future tests.
	await db
		.delete(postCollection)
		.where(eq(postCollection.id, existingPostCollection));

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});
