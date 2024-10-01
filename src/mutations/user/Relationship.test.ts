import { expect, test } from 'bun:test';
import { faker } from '@faker-js/faker';
import { createUser, makeGQLRequest, removeUser } from '../../lib/tests';

const types = ['block', 'mute', 'follow', 'request'];

for (const type of types) {
	const _type = type === 'request' ? 'follow' : type;

	test(`Authenticated | Relationships - It should check ${type}s`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		// Create our two fake users efficiently
		await Promise.all([
			createUser({ sub: user1 }),
			createUser({
				sub: user2,
				type: type === 'request' ? 'PRIVATE' : 'PUBLIC'
			})
		]);

		// Make the GraphQL request to the block endpoint
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

		// Check for the expected type
		expect(data).toHaveProperty(
			`data.${_type}User.type`,
			type === 'request' ? 'REQUEST' : type.toUpperCase()
		);

		// Make the GraphQL request to the unblock endpoint
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

		// Check for the expected type after unblocking
		expect(undoneData).toHaveProperty(
			`data.un${_type}User.type`,
			type === 'request' ? 'REQUEST' : type.toUpperCase()
		);

		// Clean up all of the testing data
		await Promise.all([removeUser(user1), removeUser(user2)]);
	});
}

for (const type of ['accept', 'deny']) {
	test(`Authenticated | Relationships - It should ${type} a follow request`, async () => {
		const user1 = faker.string.uuid();
		const user2 = faker.string.uuid();

		// Create our two fake users efficiently
		await Promise.all([
			createUser({ sub: user1 }),
			createUser({
				sub: user2,
				type: 'PRIVATE'
			})
		]);

		// Make the GraphQL request to the block endpoint
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

		// Check for the expected type
		expect(data).toHaveProperty(`data.followUser.type`, 'REQUEST');

		// Make the GraphQL request to the unblock endpoint
		const undoneData = await makeGQLRequest(
			`
                mutation {
                    ${type}FollowRequest(id: "${user1}") {
                        type
                    }
                }
            `,
			user2
		);

		// Check for the expected type after unblocking
		expect(undoneData).toHaveProperty(
			`data.${type}FollowRequest.type`,
			type === 'accept' ? 'FOLLOW' : 'REQUEST'
		);

		// Clean up all of the testing data
		await Promise.all([removeUser(user1), removeUser(user2)]);
	});
}
