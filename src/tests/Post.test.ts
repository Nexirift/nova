import { expect, test } from 'bun:test';
import { db } from '../drizzle/db';
import { post, user } from '../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../lib/tests';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';

test('Unauthenticated | General - It should get a non-existing post', async () => {
	const nonExistingPost = faker.string.uuid();

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(`
                query {
                    getPost(id: "${nonExistingPost}") {
                        id
                        content
                    }
                }
            `);

	// Expect the getPost data to be empty (null).
	expect(data).toHaveProperty('data.getPost', null);
});

test('Authenticated | General - It should create a new post', async () => {
	const postContent = faker.lorem.words(10);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    createPost(content: "${postContent}") {
                        id
                        content
                    }
                }
            `,
		user1
	);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.createPost.content', postContent);

	// Remove that test post from the database for future tests.
	await db.delete(post).where(eq(post.id, data.data.createPost.id));

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | General - It should update an existing post', async () => {
	const existingPost = faker.string.uuid();
	const postContent = faker.lorem.words(10);
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1
	});

	// Make the GraphQL request to the getPost endpoint.
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

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.updatePost.content', postContent);

	// Remove that test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});

test('Authenticated | General - It should delete an existing post', async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1
	});

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(
		`
                mutation {
                    deletePost(id: "${existingPost}")
                }
            `,
		user1
	);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.deletePost', true);

	// Remove that test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});

test('Unauthenticated | General - It should get an existing post', async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({
		sub: user1
	});

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1
	});

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(`
                query {
                    getPost(id: "${existingPost}") {
                        id
                        content
                    }
                }
            `);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.getPost.id', existingPost);
	expect(data).toHaveProperty('data.getPost.content', 'test');

	// Remove that test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});

const types = ['like', 'bookmark', 'repost'];

for (const type of types) {
	test(`Authenticated | Interactions - It should check ${type}s`, async () => {
		const existingPost = faker.string.uuid();
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		// Create our two fake users efficiently
		await Promise.all([
			createUser({ sub: user1 }),
			createUser({ sub: user2 })
		]);

		await db.insert(post).values({
			id: existingPost,
			content: 'test',
			authorId: user1
		});

		// Make the GraphQL request to the like endpoint
		const data = await makeGQLRequest(
			`
                mutation {
                    ${type}Post(id: "${existingPost}") {
                        type
                    }
                }
            `,
			user1
		);

		// Check for the expected type
		expect(data).toHaveProperty(
			`data.${type}Post.type`,
			type.toUpperCase()
		);

		// Make the GraphQL request to the unlike endpoint
		const undoneData = await makeGQLRequest(
			`
                mutation {
                    un${type}Post(id: "${existingPost}") {
                        type
                    }
                }
            `,
			user1
		);

		// Check for the expected type after unliking
		expect(undoneData).toHaveProperty(
			`data.un${type}Post.type`,
			type.toUpperCase()
		);

		// Clean up all of the testing data
		await Promise.all([
			await db.delete(post).where(eq(post.id, existingPost)),
			removeUser(user1),
			removeUser(user2)
		]);
	});
}
