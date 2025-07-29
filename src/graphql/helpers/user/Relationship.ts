import type { UserRelationshipSchemaType } from "@/db/schema";
import { userRelationship } from "@/db/schema";
import { db } from "@/db";
import { aliasedTable, and, count, eq, or } from "drizzle-orm";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { Context } from "@/context";

const UserRelationshipStats = builder.simpleObject("UserRelationshipStats", {
  fields: (t) => ({
    // Counters for relationship metrics
    followers: t.int({
      nullable: false,
      description: "Number of users following this user",
    }),
    following: t.int({
      nullable: false,
      description: "Number of users this user follows",
    }),
    blocked: t.int({
      nullable: false,
      description: "Number of users blocked by this user",
    }),
    blockers: t.int({
      nullable: false,
      description: "Number of users that have blocked this user",
    }),
    muting: t.int({
      nullable: false,
      description: "Number of users muted by this user",
    }),
    muters: t.int({
      nullable: false,
      description: "Number of users that have muted this user",
    }),
    requests: t.int({
      nullable: false,
      description: "Number of pending follow requests received",
    }),
    mutuals: t.int({
      nullable: false,
      description: "Number of mutual followers",
    }),

    // Relationship status flags for authenticated user
    isFollowing: t.boolean({
      nullable: false,
      description: "Whether the authenticated user is following this user",
    }),
    isFollower: t.boolean({
      nullable: false,
      description: "Whether this user is following the authenticated user",
    }),
    isBlocking: t.boolean({
      nullable: false,
      description: "Whether the authenticated user is blocking this user",
    }),
    isBlocked: t.boolean({
      nullable: false,
      description: "Whether this user is blocking the authenticated user",
    }),
    isMuting: t.boolean({
      nullable: false,
      description: "Whether the authenticated user is muting this user",
    }),
    isRequesting: t.boolean({
      nullable: false,
      description:
        "Whether the authenticated user has sent a follow request to this user",
    }),
    isRequested: t.boolean({
      nullable: false,
      description:
        "Whether this user has sent a follow request to the authenticated user",
    }),
  }),
});

/**
 * Gets relationship count for a user based on relationship type and direction
 * @param userId The user ID to get counts for
 * @param relationshipType The type of relationship
 * @param isIncoming Whether the relationship is incoming to the user
 */
async function getRelationshipCount(
  userId: string,
  relationshipType: UserRelationshipSchemaType["type"],
  isIncoming: boolean,
): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(userRelationship)
    .where(
      and(
        eq(
          isIncoming ? userRelationship.toId : userRelationship.fromId,
          userId,
        ),
        eq(userRelationship.type, relationshipType),
      ),
    );
  return result[0]?.count ?? 0;
}

/**
 * Calculates the number of mutual followers (users who follow and are followed by the target user)
 * @param userId The user ID to check for mutual follows
 */
async function calculateMutualsCount(userId: string): Promise<number> {
  const followerRel = aliasedTable(userRelationship, "follower");
  const followingRel = aliasedTable(userRelationship, "following");

  // Use a JOIN to get mutual followers in a single query
  const result = await db
    .select({ count: count() })
    .from(followerRel)
    .innerJoin(
      followingRel,
      and(
        // The follower ID should match between both relationships
        eq(followerRel.fromId, followingRel.toId),
        // Current user follows this person
        eq(followingRel.fromId, userId),
        eq(followingRel.type, "FOLLOW"),
        // This person follows the current user
        eq(followerRel.toId, userId),
        eq(followerRel.type, "FOLLOW"),
      ),
    );

  return result[0]?.count ?? 0;
}

/**
 * Gets relationship counts for a user
 * @param userId The user ID to get counts for
 */
async function getUserRelationshipCounts(userId: string): Promise<{
  followers: number;
  following: number;
  blocked: number;
  blockers: number;
  muting: number;
  muters: number;
  requests: number;
  mutuals: number;
}> {
  // Batch fetch all relationship counts in parallel
  const [
    followers,
    following,
    blocked,
    blockers,
    muting,
    muters,
    requests,
    mutuals,
  ] = await Promise.all([
    getRelationshipCount(userId, "FOLLOW", true),
    getRelationshipCount(userId, "FOLLOW", false),
    getRelationshipCount(userId, "BLOCK", false),
    getRelationshipCount(userId, "BLOCK", true),
    getRelationshipCount(userId, "MUTE", false),
    getRelationshipCount(userId, "MUTE", true),
    getRelationshipCount(userId, "REQUEST", true),
    calculateMutualsCount(userId),
  ]);

  return {
    followers,
    following,
    blocked,
    blockers,
    muting,
    muters,
    requests,
    mutuals,
  };
}

/**
 * Gets relationship statuses between a target user and the authenticated user
 * @param targetUserId The target user ID
 * @param currentUserId The authenticated user ID
 */
async function getUserRelationshipStatuses(
  targetUserId: string,
  currentUserId: string | undefined,
): Promise<{
  isFollowing: boolean;
  isFollower: boolean;
  isBlocking: boolean;
  isBlocked: boolean;
  isMuting: boolean;
  isRequesting: boolean;
  isRequested: boolean;
}> {
  // Default values when no authenticated user
  if (!currentUserId) {
    return {
      isFollowing: false,
      isFollower: false,
      isBlocking: false,
      isBlocked: false,
      isMuting: false,
      isRequesting: false,
      isRequested: false,
    };
  }

  // Optimize by checking all relationships in parallel
  const relationshipPromises = [
    // Current user -> Target user relationships
    db
      .select({ type: userRelationship.type })
      .from(userRelationship)
      .where(
        and(
          eq(userRelationship.fromId, currentUserId),
          eq(userRelationship.toId, targetUserId),
        ),
      ),

    // Target user -> Current user relationships
    db
      .select({ type: userRelationship.type })
      .from(userRelationship)
      .where(
        and(
          eq(userRelationship.fromId, targetUserId),
          eq(userRelationship.toId, currentUserId),
        ),
      ),
  ];

  const [outgoing, incoming] = await Promise.all(relationshipPromises);

  // Create maps for faster lookups
  const outgoingRelations = new Set(outgoing?.map((r) => r.type));
  const incomingRelations = new Set(incoming?.map((r) => r.type));

  return {
    isFollowing: outgoingRelations.has("FOLLOW"),
    isFollower: incomingRelations.has("FOLLOW"),
    isBlocking: outgoingRelations.has("BLOCK"),
    isBlocked: incomingRelations.has("BLOCK"),
    isMuting: outgoingRelations.has("MUTE"),
    isRequesting: outgoingRelations.has("REQUEST"),
    isRequested: incomingRelations.has("REQUEST"),
  };
}

/**
 * Retrieves complete relationship statistics for a user
 * @param userId The user ID to get statistics for
 * @param currentUserId The authenticated user ID (if available)
 */
async function getCompleteRelationshipStats(
  userId: string,
  currentUserId: string | undefined,
): Promise<{
  followers: number;
  following: number;
  blocked: number;
  blockers: number;
  muting: number;
  muters: number;
  requests: number;
  mutuals: number;
  isFollowing: boolean;
  isFollower: boolean;
  isBlocking: boolean;
  isBlocked: boolean;
  isMuting: boolean;
  isRequesting: boolean;
  isRequested: boolean;
}> {
  // Fetch all stats in parallel for better performance
  const [counts, statuses] = await Promise.all([
    getUserRelationshipCounts(userId),
    getUserRelationshipStatuses(userId, currentUserId),
  ]);

  return {
    ...counts,
    ...statuses,
  };
}

export { UserRelationshipStats, getCompleteRelationshipStats };

// Function to modify user relationships
async function modifyRelationship(
  ctx: Context,
  args: { id: string; reason?: string | null },
  type: "BLOCK" | "UNBLOCK" | "MUTE" | "UNMUTE" | "FOLLOW" | "UNFOLLOW",
): Promise<UserRelationshipSchemaType | null> {
  // Prevent users from performing actions on themselves
  if (ctx.auth?.user?.id === args.id) {
    return throwError(
      `You cannot ${type.toLowerCase()} yourself.`,
      `CANNOT_${type.toUpperCase()}_SELF`,
    );
  }

  // Check if the requested user exists
  const requestedUser = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.id, args.id),
  });

  if (!requestedUser) {
    return throwError("User not found.", "USER_NOT_FOUND");
  }

  // Map relationship types to their corresponding database values
  const relationshipMap = {
    BLOCK: "BLOCK",
    UNBLOCK: "BLOCK",
    MUTE: "MUTE",
    UNMUTE: "MUTE",
    FOLLOW: "FOLLOW",
    UNFOLLOW: "FOLLOW",
  };

  // Map error messages for each relationship type
  const errorMap = {
    BLOCK: "You have already blocked this user.",
    UNBLOCK: "You are not currently blocking this user.",
    MUTE: "You have already muted this user.",
    UNMUTE: "You are not currently muting this user.",
    FOLLOW:
      "You have already followed this user or a request has already been sent.",
    UNFOLLOW:
      "You are not currently following this user or have not sent a follow request.",
  };

  const requestedType = relationshipMap[type];

  // Check if the relationship already exists
  const requestedRelationship = await db.query.userRelationship.findFirst({
    where: (userRelationship, { and }) =>
      and(
        eq(userRelationship.fromId, ctx.auth?.user?.id),
        eq(userRelationship.toId, args.id),
        eq(
          userRelationship.type,
          requestedType as "BLOCK" | "MUTE" | "FOLLOW" | "REQUEST",
        ),
      ),
  });

  // Helper function to check for existing relationships
  async function hasExistingRelationship(
    ctx: Context,
    args: { id: string },
    type: "BLOCK" | "UNBLOCK" | "MUTE" | "UNMUTE" | "FOLLOW" | "UNFOLLOW",
  ) {
    const requestedType = relationshipMap[type];
    return db.query.userRelationship.findFirst({
      where: (userRelationship, { and }) =>
        and(
          eq(userRelationship.fromId, ctx.auth?.user?.id),
          eq(userRelationship.toId, args.id),
          eq(
            userRelationship.type,
            requestedType as "BLOCK" | "MUTE" | "FOLLOW" | "REQUEST",
          ),
        ),
    });
  }

  // Helper function to throw errors for non-actioned users
  async function throwUserNotActionedError(
    type: "BLOCK" | "UNBLOCK" | "MUTE" | "UNMUTE" | "FOLLOW" | "UNFOLLOW",
  ) {
    return throwError(errorMap[type], `USER_NOT_${type}ED`);
  }

  // Handle BLOCK, MUTE, and FOLLOW actions
  if (["BLOCK", "MUTE", "FOLLOW"].includes(type)) {
    const existingRelationship = await hasExistingRelationship(ctx, args, type);
    if (existingRelationship) {
      return throwError(errorMap[type], `USER_ALREADY_${type}ED`);
    }

    // Handle follow requests for private users
    if (type === "FOLLOW" && requestedUser.type === "PRIVATE") {
      const followRequest = await db.query.userRelationship.findFirst({
        where: (userRelationship, { and }) =>
          and(
            eq(userRelationship.fromId, ctx.auth?.user?.id),
            eq(userRelationship.toId, args.id),
            eq(userRelationship.type, "REQUEST"),
          ),
      });

      if (followRequest) {
        return throwError(errorMap[type], `USER_ALREADY_${type}ED`);
      }
      return db
        .insert(userRelationship)
        .values({
          fromId: ctx.auth?.user?.id,
          toId: args.id,
          type: "REQUEST",
          reason: args.reason,
        })
        .returning()
        .then((res) => res[0] || null);
    }

    // Handle blocking users
    if (type === "BLOCK") {
      await db
        .delete(userRelationship)
        .where(
          and(
            or(
              and(
                eq(userRelationship.fromId, ctx.auth?.user?.id),
                eq(userRelationship.toId, args.id),
              ),
              and(
                eq(userRelationship.fromId, args.id),
                eq(userRelationship.toId, ctx.auth?.user?.id),
              ),
            ),
            or(
              eq(userRelationship.type, "REQUEST"),
              eq(userRelationship.type, "FOLLOW"),
            ),
          ),
        )
        .execute();
    }

    // Insert new relationship
    return db
      .insert(userRelationship)
      .values({
        fromId: ctx.auth?.user?.id,
        toId: args.id,
        type: type as "BLOCK" | "MUTE" | "FOLLOW" | "REQUEST",
        reason: args.reason,
      })
      .returning()
      .then((res) => res[0] || null);
  } else {
    // Handle UNBLOCK, UNMUTE, and UNFOLLOW actions
    if (!requestedRelationship) {
      const followRequest = await db.query.userRelationship.findFirst({
        where: (userRelationship, { and }) =>
          and(
            eq(userRelationship.fromId, ctx.auth?.user?.id),
            eq(userRelationship.toId, args.id),
            eq(userRelationship.type, "REQUEST"),
          ),
      });

      if (!followRequest) {
        throw await throwUserNotActionedError(type);
      }

      return db
        .delete(userRelationship)
        .where(
          and(
            eq(userRelationship.fromId, ctx.auth?.user?.id),
            eq(userRelationship.toId, args.id),
            eq(userRelationship.type, "REQUEST"),
          ),
        )
        .returning()
        .then((res) => res[0] || null);
    }

    // Delete existing relationship
    return db
      .delete(userRelationship)
      .where(
        and(
          eq(userRelationship.fromId, ctx.auth?.user?.id),
          eq(userRelationship.toId, args.id),
        ),
      )
      .returning()
      .then((res) => res[0] || null);
  }
}

export { modifyRelationship };
