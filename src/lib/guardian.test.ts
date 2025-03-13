import { faker } from '@faker-js/faker';
import { db, userRelationship } from '@nexirift/db';
import { BetterAuth } from '@nexirift/plugin-better-auth';
import { expect, test } from 'bun:test';
import { redisClient } from '../redis';
import { privacyGuardian } from './guardian';
import { createUser } from './tests';

function createFakeToken(sub: string): BetterAuth {
	/* eslint-disable  @typescript-eslint/no-explicit-any */
	return new BetterAuth({
		client: {} as any,
		session: {} as any,
		user: {
			id: sub
		} as any
	});
}

test('Authenticated | General - It should return false if user ID or type is null', async () => {
	const result = await privacyGuardian(
		{ id: null, type: null },
		createFakeToken('test')
	);
	expect(result).toBe(false);
});

test('Authenticated | General - It should return cached result if available', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	const user1db = await createUser({ sub: user1 });
	await createUser({
		sub: user2,
		type: 'PRIVATE'
	});

	await redisClient.setEx(`privacyGuardian:${user1}:${user2}`, 1, 'true');
	const result = await privacyGuardian(user1db, createFakeToken(user2));
	expect(result).toBe(true);
});

test('Authenticated | General - It should return true if user is accessing their own data', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	const user1db = await createUser({ sub: user1 });
	await createUser({
		sub: user2,
		type: 'PRIVATE'
	});

	const result = await privacyGuardian(user1db, createFakeToken(user1));
	expect(result).toBe(true);
});

test('Authenticated | General - It should return true if user type is PRIVATE and followed', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUser({ sub: user1 });
	const user2db = await createUser({
		sub: user2,
		type: 'PRIVATE'
	});

	await db.insert(userRelationship).values({
		fromId: user1,
		toId: user2,
		type: 'FOLLOW'
	});

	const result = await privacyGuardian(user2db, createFakeToken(user1));
	expect(result).toBe(true);
});

test('Authenticated | General - It should return false if user type is PRIVATE and not followed', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUser({ sub: user1 });
	const user2db = await createUser({
		sub: user2,
		type: 'PRIVATE'
	});

	const result = await privacyGuardian(user2db, createFakeToken(user1));
	expect(result).toBe(false);
});

test('Authenticated | General - It should return false if user is blocked by the other user', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUser({ sub: user1 });
	const user2db = await createUser({
		sub: user2,
		type: 'PRIVATE'
	});

	await db.insert(userRelationship).values({
		fromId: user2,
		toId: user1,
		type: 'BLOCK'
	});

	const result = await privacyGuardian(user2db, createFakeToken(user1));
	expect(result).toBe(false);
});

test('Authenticated | General - It should return true if user is not blocked by the other user', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	const user1db = await createUser({ sub: user1 });
	await createUser({
		sub: user2,
		type: 'PUBLIC'
	});

	const result = await privacyGuardian(user1db, createFakeToken(user2));
	expect(result).toBe(true);
});

test('Authenticated | General - It should cache the result for 5 seconds', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	const user1db = await createUser({ sub: user1 });
	await createUser({
		sub: user2,
		type: 'PRIVATE'
	});

	await privacyGuardian(user1db, createFakeToken(user2));
	const cachedResult = await redisClient.get(
		`privacyGuardian:${user1}:${user2}`
	);
	expect(cachedResult).toBe('true');
});

test('Authenticated | General - It should return false if user type is PUBLIC and blocked', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	await createUser({ sub: user1 });
	const user2db = await createUser({
		sub: user2,
		type: 'PUBLIC'
	});

	await db.insert(userRelationship).values({
		fromId: user2,
		toId: user1,
		type: 'BLOCK'
	});

	const result = await privacyGuardian(user2db, createFakeToken(user1));
	expect(result).toBe(false);
});

test('Authenticated | General - It should return true if user type is PUBLIC and not blocked', async () => {
	const user1 = faker.string.uuid();
	const user2 = faker.string.uuid();

	const user1db = await createUser({ sub: user1 });
	await createUser({
		sub: user2,
		type: 'PUBLIC'
	});

	const result = await privacyGuardian(user1db, createFakeToken(user2));
	expect(result).toBe(true);
});
