import { faker } from '@faker-js/faker';
import { db, post, postCollection, postCollectionItem } from '@nexirift/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const types = ['PUBLIC', 'PRIVATE'];

async function setupUserAndCollection() {
	const user1 = faker.string.uuid();
	await createUser({ sub: user1 });
	const postCollectionName = faker.lorem.words(5);
	const postCollectionDescription = faker.lorem.words(10);
	return { user1, postCollectionName, postCollectionDescription };
}

async function cleanup(user1: string, collectionId?: string, postId?: string) {
	if (postId) {
		await db
			.delete(postCollectionItem)
			.where(eq(postCollectionItem.postId, postId));
		await db.delete(post).where(eq(post.id, postId));
	}
	if (collectionId) {
		await db
			.delete(postCollection)
			.where(eq(postCollection.id, collectionId));
	}
	await removeUser(user1);
}

for (const type of types) {
	test(`Authenticated | Collections - It should create a new post collection (${type})`, async () => {
		const { user1, postCollectionName, postCollectionDescription } =
			await setupUserAndCollection();

		const data = await makeGQLRequest(
			`mutation {
				createPostCollection(name: "${postCollectionName}", description: "${postCollectionDescription}", visibility: "${type}") {
					id
					name
					description
					visibility
				}
			}`,
			user1
		);

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

		await cleanup(user1, data.data.createPostCollection.id);
	});
}

for (const type of types) {
	test(`Authenticated | Collections - It should update an existing post collection (${
		type === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
	} to ${type})`, async () => {
		const { user1, postCollectionName, postCollectionDescription } =
			await setupUserAndCollection();
		const existingPostCollection = faker.string.uuid();

		await db.insert(postCollection).values({
			id: existingPostCollection,
			name: postCollectionName,
			description: postCollectionDescription,
			visibility: type === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC',
			userId: user1
		});

		const data = await makeGQLRequest(
			`mutation {
				updatePostCollection(id: "${existingPostCollection}", name: "Test Collection", description: "This is a test collection.", visibility: "${type}") {
					id
					name
					description
					visibility
				}
			}`,
			user1
		);

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

		await cleanup(user1, existingPostCollection);
	});
}

test('Authenticated | Collections - It should delete an existing post collection', async () => {
	const { user1 } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();

	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	const data = await makeGQLRequest(
		`mutation { deletePostCollection(id: "${existingPostCollection}") }`,
		user1
	);

	expect(data).toHaveProperty('data.deletePostCollection', true);

	await cleanup(user1, existingPostCollection);
});

test('Authenticated | Collections - It should add a post to a collection', async () => {
	const { user1 } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();
	const existingPost = faker.string.uuid();

	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1,
		published: true
	});

	const data = await makeGQLRequest(
		`mutation {
			addPostToCollection(id: "${existingPostCollection}", postId: "${existingPost}") {
				post { id content }
				collection { id name description visibility }
			}
		}`,
		user1
	);

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

	await cleanup(user1, existingPostCollection, existingPost);
});

test('Authenticated | Collections - It should remove a post from a collection', async () => {
	const { user1 } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();
	const existingPost = faker.string.uuid();

	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: 'Test Collection',
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1,
		published: true
	});

	await db.insert(postCollectionItem).values({
		collectionId: existingPostCollection,
		postId: existingPost
	});

	const data = await makeGQLRequest(
		`mutation { removePostFromCollection(id: "${existingPostCollection}", postId: "${existingPost}") { collection { id } post { id } } }`,
		user1
	);

	expect(data).toHaveProperty(
		'data.removePostFromCollection.collection.id',
		existingPostCollection
	);

	expect(data).toHaveProperty(
		'data.removePostFromCollection.post.id',
		existingPost
	);

	await cleanup(user1, existingPostCollection, existingPost);
});

test('Authenticated | Collections - It should fail if the post collection already exists', async () => {
	const { user1, postCollectionName } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();

	await db.insert(postCollection).values({
		id: existingPostCollection,
		name: postCollectionName,
		description: 'This is a collection for testing purposes.',
		visibility: 'PUBLIC',
		userId: user1
	});

	const data = await makeGQLRequest(
		`mutation { createPostCollection(name: "${postCollectionName}") { id } }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Post collection already exists.'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'POST_COLLECTION_ALREADY_EXISTS'
	);

	await cleanup(user1, existingPostCollection);
});

test('Authenticated | Collections - It should fail if the post collection does not exist for update', async () => {
	const { user1, postCollectionName } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();

	const data = await makeGQLRequest(
		`mutation { updatePostCollection(id: "${existingPostCollection}", name: "${postCollectionName}") { id } }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Post collection not found.'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'POST_COLLECTION_NOT_FOUND'
	);

	await cleanup(user1);
});

test('Authenticated | Collections - It should fail if the post collection does not exist for delete', async () => {
	const { user1 } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();

	const data = await makeGQLRequest(
		`mutation { deletePostCollection(id: "${existingPostCollection}") }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Post collection not found.'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'POST_COLLECTION_NOT_FOUND'
	);

	await cleanup(user1);
});

test('Authenticated | Collections - It should fail if the post collection does not exist for add post to collection', async () => {
	const { user1 } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();
	const existingPost = faker.string.uuid();

	const data = await makeGQLRequest(
		`mutation { addPostToCollection(id: "${existingPostCollection}", postId: "${existingPost}") { post { id } } }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Post collection not found.'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'POST_COLLECTION_NOT_FOUND'
	);

	await cleanup(user1);
});

test('Authenticated | Collections - It should fail if the post collection does not exist for remove post from collection', async () => {
	const { user1 } = await setupUserAndCollection();
	const existingPostCollection = faker.string.uuid();
	const existingPost = faker.string.uuid();

	const data = await makeGQLRequest(
		`mutation { removePostFromCollection(id: "${existingPostCollection}", postId: "${existingPost}") { collection { id } post { id } } }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'Post collection not found.'
	);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'POST_COLLECTION_NOT_FOUND'
	);

	await cleanup(user1);
});
