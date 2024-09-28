import { expect, test } from 'bun:test';
import { db } from '../drizzle/db';
import { post, user } from '../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../lib/tests';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';

test('unauthenticated | get non-existing post', async () => {
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

test('unauthenticated | get existing post', async () => {
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

	// Remove that test post from the database for future tests.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove that test user from the database for future tests.
	await removeUser(user1);
});
