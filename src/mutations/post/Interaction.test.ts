import { faker } from '@faker-js/faker';
import { db, post, postInteraction } from '@nexirift/db';
import { expect, test } from 'bun:test';
import { and, eq, or } from 'drizzle-orm';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const types = ['like', 'repost'];

const setupTest = async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await Promise.all([createUser({ sub: user1 }), createUser({ sub: user2 })]);

	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user1,
		published: true
	});

	return { existingPost, user1, user2 };
};

const cleanupTest = async (
	existingPost: string,
	user1: string,
	user2: string
) => {
	await db
		.delete(postInteraction)
		.where(
			and(
				eq(postInteraction.postId, existingPost),
				or(
					eq(postInteraction.userId, user1),
					eq(postInteraction.userId, user2)
				)
			)
		);

	await db.delete(post).where(eq(post.id, existingPost));
	await Promise.all([removeUser(user1), removeUser(user2)]);
};

for (const type of types) {
	test(`Authenticated | Interactions - It should check ${type}s`, async () => {
		const { existingPost, user1, user2 } = await setupTest();

		const data = await makeGQLRequest(
			`mutation { ${type}Post(id: "${existingPost}") { type } }`,
			user1
		);

		expect(data).toHaveProperty(
			`data.${type}Post.type`,
			type.toUpperCase()
		);

		const undoneData = await makeGQLRequest(
			`mutation { un${type}Post(id: "${existingPost}") { type } }`,
			user1
		);

		expect(undoneData).toHaveProperty(
			`data.un${type}Post.type`,
			type.toUpperCase()
		);

		await cleanupTest(existingPost, user1, user2);
	});

	test(`Authenticated | Interactions - It should check if the post was already ${type}ed and un${type}ed`, async () => {
		const { existingPost, user1, user2 } = await setupTest();

		const data = await makeGQLRequest(
			`mutation { ${type}Post(id: "${existingPost}") { type } }`,
			user1
		);

		expect(data).toHaveProperty(
			`data.${type}Post.type`,
			type.toUpperCase()
		);

		const data2 = await makeGQLRequest(
			`mutation { ${type}Post(id: "${existingPost}") { type } }`,
			user1
		);

		const errorMap: { [key: string]: string } = {
			LIKE: 'You have already liked this post.',
			UNLIKE: 'You are not currently liking this post.',
			REPOST: 'You have already reposted this post.',
			UNREPOST: 'You are not currently reposting this post.'
		};

		expect(data2.errors[0]).toHaveProperty(
			'message',
			errorMap[type.toUpperCase()]
		);
		expect(data2.errors[0].extensions).toHaveProperty(
			'code',
			`POST_ALREADY_${type.toUpperCase()}ED`
		);

		const undoneData = await makeGQLRequest(
			`mutation { un${type}Post(id: "${existingPost}") { type } }`,
			user1
		);

		expect(undoneData).toHaveProperty(
			`data.un${type}Post.type`,
			type.toUpperCase()
		);

		const undoneData2 = await makeGQLRequest(
			`mutation { un${type}Post(id: "${existingPost}") { type } }`,
			user1
		);

		expect(undoneData2.errors[0]).toHaveProperty(
			'message',
			errorMap['UN' + type.toUpperCase()]
		);
		expect(undoneData2.errors[0].extensions).toHaveProperty(
			'code',
			`POST_NOT_${type.toUpperCase()}ED`
		);

		await cleanupTest(existingPost, user1, user2);
	});
}

test(`Authenticated | Interactions - It should fail if the post does not exist for like`, async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();

	await createUser({ sub: user1 });

	const data = await makeGQLRequest(
		`mutation { likePost(id: "${existingPost}") { type } }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty('message', 'Post not found.');
	expect(data.errors[0].extensions).toHaveProperty('code', 'POST_NOT_FOUND');

	await removeUser(user1);
});

test(`Authenticated | Interactions - It should fail if the author of the post is private and the user is not following them`, async () => {
	const existingPost = faker.string.uuid();
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await Promise.all([
		createUser({ sub: user1 }),
		createUser({ sub: user2, type: 'PRIVATE' })
	]);

	await db.insert(post).values({
		id: existingPost,
		content: 'test',
		authorId: user2,
		published: true
	});

	const data = await makeGQLRequest(
		`mutation { likePost(id: "${existingPost}") { type } }`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'You cannot interact with this post.'
	);
	expect(data.errors[0].extensions).toHaveProperty('code', 'POST_PRIVACY');

	await removeUser(user1);
});
