import { faker } from '@faker-js/faker';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../drizzle/db';
import { post } from '../../drizzle/schema';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const types = ['like', 'repost'];

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
