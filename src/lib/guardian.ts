import { OIDCToken } from '@nexirift/plugin-oidc';
import { Context } from '../context';
import { db } from '../drizzle/db';
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
	user: { id: string | null; type: 'PUBLIC' | 'PRIVATE' | null },
	token: OIDCToken
): Promise<boolean> {
	if (user.id === null || user.type === null) {
		return false;
	}

	// Generate a unique cache key
	const cacheKey = `privacyGuardian:${user.id}:${token?.sub}`;

	// Try to get the result from cache
	const cachedResult = await redisClient.get(cacheKey);
	if (cachedResult !== null) {
		guardianLog(`Cache hit for user ${user.id} and token ${token?.sub}`);
		return cachedResult === 'true'; // Convert string back to boolean
	}

	let result = false; // Default result

	guardianLog(`Checking privacy for user ${user.id} and token ${token?.sub}`);

	if (token?.sub === user.id) {
		result = true;
	} else if (user.type === 'PRIVATE') {
		const followingRelationship = await db.query.userRelationship.findFirst(
			{
				where: (userRelationship, { eq, and }) =>
					and(
						eq(userRelationship.fromId, token?.sub),
						eq(userRelationship.toId, user.id!),
						eq(userRelationship.type, 'FOLLOW')
					)
			}
		);

		result = !!followingRelationship;
		if (!result) {
			guardianLog(
				`User ${user.id} is PRIVATE and not followed by ${token?.sub}`
			);
		}
	} else {
		const blockedRelationship = await db.query.userRelationship.findFirst({
			where: (userRelationship, { eq, and }) =>
				and(
					eq(userRelationship.fromId, user.id!),
					eq(userRelationship.toId, token?.sub),
					eq(userRelationship.type, 'BLOCK')
				)
		});

		result = !blockedRelationship;
		if (!result) {
			guardianLog(`User ${user.id} has blocked ${token?.sub}`);
		}
	}

	guardianLog(
		`Result for user ${user.id} and token ${token?.sub} is ${result}`
	);

	// Cache the result for 5 seconds
	await redisClient.setEx(cacheKey, 5, String(result));

	return result;
}

export { privacyGuardian };
