import { faker } from '@faker-js/faker';
import { db, userRelationship } from '@nexirift/db';
import { expect, test } from 'bun:test';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const errorMap = {
	BLOCK: 'You have already blocked this user.',
	UNBLOCK: 'You are not currently blocking this user.',
	MUTE: 'You have already muted this user.',
	UNMUTE: 'You are not currently muting this user.',
	FOLLOW: 'You have already followed this user or a request has already been sent.',
	UNFOLLOW:
		'You are not currently following this user or have not sent a follow request.'
};

const types = ['block', 'mute', 'follow', 'request'];

const createUsers = async (user1: string, user2: string, type: string) => {
	await Promise.all([
		createUser({ sub: user1 }),
		createUser({
			sub: user2,
			type: type === 'request' ? 'PRIVATE' : 'PUBLIC'
		})
	]);
};

const cleanUpUsers = async (user1: string, user2: string) => {
	await Promise.all([removeUser(user1), removeUser(user2)]);
};

for (const type of types) {
	const _type = type === 'request' ? 'follow' : type;

	test(`Authenticated | Relationships - It should check ${type}s`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		await createUsers(user1, user2, type);

		const data = await makeGQLRequest(
			`
				mutation {
					${_type}User(id: "${user2}") {
						type
					}
				}
			`,
			user1
		);

		expect(data).toHaveProperty(
			`data.${_type}User.type`,
			type === 'request' ? 'REQUEST' : type.toUpperCase()
		);

		const undoneData = await makeGQLRequest(
			`
				mutation {
					un${_type}User(id: "${user2}") {
						type
					}
				}
			`,
			user1
		);

		expect(undoneData).toHaveProperty(
			`data.un${_type}User.type`,
			type === 'request' ? 'REQUEST' : type.toUpperCase()
		);

		await cleanUpUsers(user1, user2);
	});
}

test('Authenticated | Relationships - It should throw an error if there is an existing request', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();
	await createUser({ sub: user2 });
	await createUser({ sub: user1, type: 'PRIVATE' });
	await db.insert(userRelationship).values({
		fromId: user2,
		toId: user1,
		type: 'REQUEST'
	});
	const data = await makeGQLRequest(
		`
			mutation {
				followUser(id: "${user1}") {
					type
				}
			}
		`,
		user2
	);
	expect(data.errors[0]).toHaveProperty('message', errorMap.FOLLOW);
	expect(data.errors[0].extensions).toHaveProperty(
		'code',
		'USER_ALREADY_FOLLOWED'
	);
});

const types2 = ['block', 'mute', 'follow'];

for (const type of types2) {
	test(`Authenticated | Relationships - It should check if the relationship does not exist (${type})`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		await createUsers(user1, user2, type);

		const data = await makeGQLRequest(
			`
			mutation {
				un${type}User(id: "${user2}") {
					type
				}
			}
		`,
			user1
		);

		expect(data.errors[0]).toHaveProperty(
			'message',
			errorMap[
				('UN' + type.toUpperCase()) as 'UNBLOCK' | 'UNMUTE' | 'UNFOLLOW'
			]
		);
		expect(data.errors[0].extensions).toHaveProperty(
			'code',
			`USER_NOT_UN${type.toUpperCase()}ED`
		);
	});
}

test('Authenticated | Relationships - It should throw an error for self-action', async () => {
	const user1 = faker.string.uuid();

	await createUser({ sub: user1 });

	const data = await makeGQLRequest(
		`
			mutation {
				followUser(id: "${user1}") {
					type
				}
			}
		`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'You cannot follow yourself.'
	);

	await removeUser(user1);
});

test('Authenticated | Relationships - It should throw an error for non-existing user', async () => {
	const user1 = faker.string.uuid();
	const nonExistingUser = faker.string.uuid();

	await createUser({ sub: user1 });

	const data = await makeGQLRequest(
		`
			mutation {
				followUser(id: "${nonExistingUser}") {
					type
				}
			}
		`,
		user1
	);

	expect(data.errors[0]).toHaveProperty('message', 'User not found.');

	await removeUser(user1);
});

test('Authenticated | Relationships - It should throw an error for existing relationship', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUsers(user1, user2, 'follow');

	await makeGQLRequest(
		`
			mutation {
				followUser(id: "${user2}") {
					type
				}
			}
		`,
		user1
	);

	const data = await makeGQLRequest(
		`
			mutation {
				followUser(id: "${user2}") {
					type
				}
			}
		`,
		user1
	);

	expect(data.errors[0]).toHaveProperty('message', errorMap.FOLLOW);

	await cleanUpUsers(user1, user2);
});

test('Authenticated | Relationships - It should handle follow requests for private users', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUsers(user1, user2, 'request');

	const data = await makeGQLRequest(
		`
			mutation {
				followUser(id: "${user2}") {
					type
				}
			}
		`,
		user1
	);

	expect(data).toHaveProperty('data.followUser.type', 'REQUEST');

	await cleanUpUsers(user1, user2);
});

test('Authenticated | Relationships - It should handle blocking users', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUsers(user1, user2, 'block');

	const data = await makeGQLRequest(
		`
			mutation {
				blockUser(id: "${user2}") {
					type
				}
			}
		`,
		user1
	);

	expect(data).toHaveProperty('data.blockUser.type', 'BLOCK');

	await cleanUpUsers(user1, user2);
});

test('Authenticated | Relationships - It should accept follow requests', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUsers(user1, user2, 'request');

	await db.insert(userRelationship).values({
		fromId: user2,
		toId: user1,
		type: 'REQUEST'
	});

	const data = await makeGQLRequest(
		`
				mutation {
					acceptFollowRequest(id: "${user2}") { type }
				}
			`,
		user1
	);

	expect(data).toHaveProperty('data.acceptFollowRequest.type', 'FOLLOW');

	await cleanUpUsers(user1, user2);
});

test('Authenticated | Relationships - It should deny follow requests', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUsers(user1, user2, 'request');

	await db.insert(userRelationship).values({
		fromId: user2,
		toId: user1,
		type: 'REQUEST'
	});

	const data = await makeGQLRequest(
		`
			mutation {
				denyFollowRequest(id: "${user2}")
			}
		`,
		user1
	);

	expect(data).toHaveProperty('data.denyFollowRequest', true);

	await cleanUpUsers(user1, user2);
});

test('Authenticated | Relationships - It should fail if the user does not exist', async () => {
	const user1 = faker.string.uuid();
	const nonExistingUser = faker.string.uuid();

	await createUser({ sub: user1 });

	const data = await makeGQLRequest(
		`
			mutation {
				denyFollowRequest(id: "${nonExistingUser}")
			}
		`,
		user1
	);

	expect(data.errors[0]).toHaveProperty(
		'message',
		'This user does not exist or has not sent a follow request.'
	);

	await removeUser(user1);
});

const followRequestTypes = ['accept', 'deny'];

for (const type of followRequestTypes) {
	test(`Authenticated | Relationships - It should fail if the user does not have a follow request (${type})`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		await createUsers(user1, user2, 'follow');

		const data = await makeGQLRequest(
			`
			mutation {
				${type}FollowRequest(id: "${user2}") ${type === 'accept' ? '{ type }' : ''}
			}
		`,
			user1
		);

		expect(data.errors[0]).toHaveProperty(
			'message',
			'This user does not exist or has not sent a follow request.'
		);

		await cleanUpUsers(user1, user2);
	});
}
