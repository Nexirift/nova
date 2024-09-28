import { expect, test } from 'bun:test';
import { db } from '../drizzle/db';
import { post, user } from '../drizzle/schema';
import { makeGQLRequest } from '../lib/tests';
import { eq } from 'drizzle-orm';

test('unauthenticated | get non-existing post', async () => {
	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(`
                query {
                    getPost(id: "b001a0e4-3f20-4d66-ba3e-d5f85f9f050e") {
                        id
                        content
                    }
                }
            `);

	// Expect the getPost data to be empty (null).
	expect(data).toHaveProperty('data.getPost', null);
});

test('unauthenticated | get existing post', async () => {
	const postId = 'b001a0e4-3f20-4d66-ba3e-d5f85f9f050e';

	// Insert our fake user into the database.
	await db.insert(user).values({
		id: '254afcf6c19c4979a0231ac579499cf0',
		username: 'test'
	});

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: postId,
		content: 'test',
		authorId: '254afcf6c19c4979a0231ac579499cf0'
	});

	// Make the GraphQL request to the getPost endpoint.
	const data = await makeGQLRequest(`
                query {
                    getPost(id: "b001a0e4-3f20-4d66-ba3e-d5f85f9f050e") {
                        id
                        content
                    }
                }
            `);

	// Expect the ID to be the same as what was created in the database.
	expect(data).toHaveProperty('data.getPost.id', postId);

	// Remove that test post from the database for future tests.
	await db.delete(post).where(eq(post.id, postId));

	// Remove that test user from the database for future tests.
	await db
		.delete(user)
		.where(eq(user.id, '254afcf6c19c4979a0231ac579499cf0'));
});
