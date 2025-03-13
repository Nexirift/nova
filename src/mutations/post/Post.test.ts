import { faker } from '@faker-js/faker';
import { db, post } from '@nexirift/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

test('Authenticated | General - It should create a new post', async () => {
	const postContent = faker.lorem.words(10);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({ sub: user1 });

	// Make the GraphQL request to create a new post.
	const data = await makeGQLRequest(
		`
		mutation {
			createPost(content: "${postContent}", published: true) {
				id
				content
			}
		}
		`,
		user1
	);

	// Expect the content to be the same as what was created in the database.
	expect(data).toHaveProperty('data.createPost.content', postContent);

	// Remove the test post from the database for future tests.
	await db.delete(post).where(eq(post.id, data.data.createPost.id));

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | General - It should update an existing post', async () => {
	const existingPost = faker.string.uuid();
	const postContent = faker.lorem.words(10);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({ sub: user1 });

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1,
		published: true
	});

	// Make the GraphQL request to update the post.
	const data = await makeGQLRequest(
		`
		mutation {
			updatePost(id: "${existingPost}", content: "${postContent}") {
				id
				content
			}
		}
		`,
		user1
	);

	// Expect the content to be updated in the database.
	expect(data).toHaveProperty('data.updatePost.content', postContent);

	// Remove the test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | General - It should delete an existing post', async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({ sub: user1 });

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1,
		published: true
	});

	// Make the GraphQL request to delete the post.
	const data = await makeGQLRequest(
		`
		mutation {
			deletePost(id: "${existingPost}")
		}
		`,
		user1
	);

	// Expect the post to be deleted.
	expect(data).toHaveProperty('data.deletePost', true);

	await db.delete(post).where(eq(post.id, existingPost));

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | General - It should fail if the post does not exist for update', async () => {
	const existingPost = faker.string.uuid();
	const postContent = faker.lorem.words(10);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({ sub: user1 });

	// Make the GraphQL request to update a non-existent post.
	const data = await makeGQLRequest(
		`
		mutation {
			updatePost(id: "${existingPost}", content: "${postContent}") {
				id
			}
		}
		`,
		user1
	);

	// Expect an error indicating the post was not found.
	expect(data.errors[0]).toHaveProperty('message', 'Post not found.');
	expect(data.errors[0].extensions).toHaveProperty('code', 'POST_NOT_FOUND');

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | General - It should fail if the post does not exist for delete', async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({ sub: user1 });

	// Make the GraphQL request to delete a non-existent post.
	const data = await makeGQLRequest(
		`
		mutation {
			deletePost(id: "${existingPost}")
		}
		`,
		user1
	);

	// Expect an error indicating the post was not found.
	expect(data.errors[0]).toHaveProperty('message', 'Post not found.');
	expect(data.errors[0].extensions).toHaveProperty('code', 'POST_NOT_FOUND');

	// Remove the test user from the database for future tests.
	await removeUser(user1);
});
