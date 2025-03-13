import { faker } from '@faker-js/faker';
import { db, post } from '@nexirift/db';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

let user1: string;
let existingPost: string;

beforeEach(async () => {
	user1 = faker.string.uuid();
	existingPost = faker.string.uuid();

	// Insert our fake user into the database.
	await createUser({ sub: user1 });

	// Insert our fake post into the database.
	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1,
		published: true
	});
});

afterEach(async () => {
	// Remove the test post from the database.
	await db.delete(post).where(eq(post.id, existingPost));

	// Remove the test user from the database.
	await removeUser(user1);
});

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

test('Unauthenticated | General - It should get an existing post', async () => {
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
});
