import { Context } from '../context';
import { db } from '../drizzle/db';
import { redisClient } from '../redis';

/**
 * This function checks if a user is allowed to access a resource based on their privacy settings.
 * It's a little complicated but basically, it makes sure users can't access other users if not allowed.
 * @param user The user object contains the user's ID and type.
 * @param context The context object contains the user's ID and type.
 * @returns A boolean value indicating whether the user is allowed to access the resource.
 */
async function privacyGuardian(
	user: { id: string | null; type: string | null },
	context: Context
): Promise<boolean> {
	if (user.id === null || user.type === null) {
		console.log(' missing user info: ', user);
		return false;
	}

	// Generate a unique cache key
	const cacheKey = `privacyGuardian:${user.id}:${context.oidc.sub}`;

	// Try to get the result from cache
	const cachedResult = await redisClient.get(cacheKey);
	if (cachedResult !== null) {
		return cachedResult === 'true'; // Convert string back to boolean
	}

	let result = false; // Default result

	if (context.oidc.sub === user.id) {
		result = true;
	} else if (user.type === 'PRIVATE') {
		const followingRelationship = await db.query.userRelationship.findFirst(
			{
				where: (userRelationship, { eq, and }) =>
					and(
						eq(userRelationship.fromId, context.oidc.sub),
						eq(userRelationship.toId, user.id!),
						eq(userRelationship.type, 'FOLLOW')
					)
			}
		);

		result = !!followingRelationship;
		if (!result) {
			console.log(`user ${user.id} not followed by ${context.oidc.sub}`);
		}
	} else {
		const blockedRelationship = await db.query.userRelationship.findFirst({
			where: (userRelationship, { eq, and }) =>
				and(
					eq(userRelationship.fromId, user.id!),
					eq(userRelationship.toId, context.oidc.sub),
					eq(userRelationship.type, 'BLOCK')
				)
		});

		result = !blockedRelationship;
		if (!result) {
			console.log(`user ${user.id} has blocked ${context.oidc.sub}`);
		}
	}

	// Cache the result for 5 seconds
	await redisClient.setEx(cacheKey, 5, String(result));

	return result;
}

export { privacyGuardian };
