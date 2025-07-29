import { db } from "@/db";
import { BetterAuth } from "@nexirift/plugin-better-auth";
import { redisClient } from "@/redis";
import { guardianLog } from "@/utils/logger";

/**
 * Checks if a user is allowed to access another user based on privacy settings.
 * Handles three cases:
 * 1. Users can always access their own profiles
 * 2. Private users are only accessible by their followers
 * 3. Public users are accessible by anyone who isn't blocked
 *
 * @param user The target user object containing ID and privacy type
 * @param auth Authentication context of the requesting user
 * @returns Boolean indicating access permission
 */
async function privacyGuardian(
  user:
    | {
        id: string | null | undefined;
        type?: "PUBLIC" | "PRIVATE" | null | undefined;
      }
    | undefined,
  auth: BetterAuth,
): Promise<boolean> {
  // Handle undefined user cases
  const targetUserId = user?.id;
  if (!targetUserId) {
    return false;
  }

  // Self-access is always allowed
  if (auth?.user.id === targetUserId) {
    return true;
  }

  // Check cache first
  const cacheKey = `privacyGuardian:${targetUserId}:${auth?.user.id}`;
  const cachedResult = await redisClient.get(cacheKey);
  if (cachedResult !== null) {
    guardianLog(
      `Cache hit for user ${targetUserId} and requester ${auth?.user.id}`,
    );
    return cachedResult === "true";
  }

  guardianLog(
    `Checking privacy for user ${targetUserId} and requester ${auth?.user.id}`,
  );

  // Fetch complete user data if privacy type is missing
  let privacyType = user?.type;
  if (privacyType === null || privacyType === undefined) {
    const userData = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.id, targetUserId),
    });

    if (!userData || userData.type === null) {
      return false;
    }

    privacyType = userData.type;
  }

  // Determine access based on privacy settings
  let result: boolean;

  if (privacyType === "PRIVATE") {
    // For private users, check if requester follows them
    const followingRelationship = await db.query.userRelationship.findFirst({
      where: (rel, { eq, and }) =>
        and(
          eq(rel.fromId, auth?.user.id),
          eq(rel.toId, targetUserId),
          eq(rel.type, "FOLLOW"),
        ),
    });

    result = !!followingRelationship;

    if (!result) {
      guardianLog(
        `User ${targetUserId} is PRIVATE and not followed by ${auth?.user.id}`,
      );
    }
  } else {
    // For public users, check if requester is blocked
    const blockedRelationship = await db.query.userRelationship.findFirst({
      where: (rel, { eq, and }) =>
        and(
          eq(rel.fromId, targetUserId),
          eq(rel.toId, auth?.user.id),
          eq(rel.type, "BLOCK"),
        ),
    });

    result = !blockedRelationship;

    if (!result) {
      guardianLog(`User ${targetUserId} has blocked ${auth?.user.id}`);
    }
  }

  guardianLog(
    `Result for user ${targetUserId} and requester ${auth?.user.id} is ${result}`,
  );

  // Cache the result for 5 seconds
  await redisClient.setex(cacheKey, 5, String(result));

  return result;
}

export { privacyGuardian };
