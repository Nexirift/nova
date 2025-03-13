import { db } from '@nexirift/db';
import { BetterAuth } from '@nexirift/plugin-better-auth';
import { redisClient } from '../redis';
import { guardianLog } from './logger';

/**
 * This function checks if a user is allowed to access a resource based on their privacy settings.
 * It's a little complicated but basically, it makes sure users can't access other users if not allowed.
 * @param user The user object contains the user's ID and type.
 * @param context The context object contains the user's ID and type.
 * @returns A boolean value indicating whether the user is allowed to access the resource.
 */
async function privacyGuardian(
	user:
		| {
				id: string | null | undefined;
				type: 'PUBLIC' | 'PRIVATE' | null | undefined;
		  }
		| undefined,
	auth: BetterAuth
): Promise<boolean> {
	if (user?.id === null || user?.type === null) {
		return false;
	}

	// Generate a unique cache key
	const cacheKey = `privacyGuardian:${user?.id}:${auth?.user.id}`;

	// Try to get the result from cache
	const cachedResult = await redisClient.get(cacheKey);
	if (cachedResult !== null) {
		guardianLog(
			`Cache hit for user ${user?.id} and token ${auth?.user.id}`
		);
		return cachedResult === 'true'; // Convert string back to boolean
	}

	let result = false; // Default result

	guardianLog(
		`Checking privacy for user ${user?.id} and token ${auth?.user.id}`
	);

	if (auth?.user.id === user?.id) {
		result = true;
	} else if (user?.type === 'PRIVATE') {
		const followingRelationship = await db.query.userRelationship.findFirst(
			{
				where: (userRelationship, { eq, and }) =>
					and(
						eq(userRelationship.fromId, auth?.user.id),
						eq(userRelationship.toId, user?.id ?? ''),
						eq(userRelationship.type, 'FOLLOW')
					)
			}
		);

		result = !!followingRelationship;

		if (!result) {
			guardianLog(
				`User ${user?.id} is PRIVATE and not followed by ${auth?.user.id}`
			);
		}
	} else {
		const blockedRelationship = await db.query.userRelationship.findFirst({
			where: (userRelationship, { eq, and }) =>
				and(
					eq(userRelationship.fromId, user?.id ?? ''),
					eq(userRelationship.toId, auth?.user.id),
					eq(userRelationship.type, 'BLOCK')
				)
		});

		result = !blockedRelationship;
		if (!result) {
			guardianLog(`User ${user?.id} has blocked ${auth?.user.id}`);
		}
	}

	guardianLog(
		`Result for user ${user?.id} and token ${auth?.user.id} is ${result}`
	);

	// Cache the result for 5 seconds
	await redisClient.setEx(cacheKey, 5, String(result));

	return result;
}

export { privacyGuardian };
