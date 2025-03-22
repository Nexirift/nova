import type { UserRelationshipSchemaType } from '@nexirift/db';
import { db, userRelationship } from '@nexirift/db';
import { aliasedTable, and, count, eq } from 'drizzle-orm';
import { builder } from '../../builder';

const UserRelationshipStats = builder.simpleObject('UserRelationshipStats', {
	fields: (t) => ({
		// Counters for relationship metrics
		followersCount: t.int({
			nullable: false,
			description: 'Number of users following this user'
		}),
		followingCount: t.int({
			nullable: false,
			description: 'Number of users this user follows'
		}),
		blockedCount: t.int({
			nullable: false,
			description: 'Number of users blocked by this user'
		}),
		blockersCount: t.int({
			nullable: false,
			description: 'Number of users that have blocked this user'
		}),
		mutingCount: t.int({
			nullable: false,
			description: 'Number of users muted by this user'
		}),
		mutersCount: t.int({
			nullable: false,
			description: 'Number of users that have muted this user'
		}),
		requestsCount: t.int({
			nullable: false,
			description: 'Number of pending follow requests received'
		}),
		mutualsCount: t.int({
			nullable: false,
			description: 'Number of mutual followers'
		}),

		// Relationship status flags for authenticated user
		isFollowing: t.boolean({
			nullable: false,
			description: 'Whether the authenticated user is following this user'
		}),
		isFollower: t.boolean({
			nullable: false,
			description: 'Whether this user is following the authenticated user'
		}),
		isBlocking: t.boolean({
			nullable: false,
			description: 'Whether the authenticated user is blocking this user'
		}),
		isBlocked: t.boolean({
			nullable: false,
			description: 'Whether this user is blocking the authenticated user'
		}),
		isMuting: t.boolean({
			nullable: false,
			description: 'Whether the authenticated user is muting this user'
		}),
		isRequesting: t.boolean({
			nullable: false,
			description:
				'Whether the authenticated user has sent a follow request to this user'
		}),
		isRequested: t.boolean({
			nullable: false,
			description:
				'Whether this user has sent a follow request to the authenticated user'
		})
	})
});

/**
 * Gets relationship count for a user based on relationship type and direction
 * @param userId The user ID to get counts for
 * @param relationshipType The type of relationship
 * @param isIncoming Whether the relationship is incoming to the user
 */
async function getRelationshipCount(
	userId: string,
	relationshipType: UserRelationshipSchemaType['type'],
	isIncoming: boolean
): Promise<number> {
	const result = await db
		.select({ count: count() })
		.from(userRelationship)
		.where(
			and(
				eq(
					isIncoming
						? userRelationship.toId
						: userRelationship.fromId,
					userId
				),
				eq(userRelationship.type, relationshipType)
			)
		);
	return result[0]?.count ?? 0;
}

/**
 * Calculates the number of mutual followers (users who follow and are followed by the target user)
 * @param userId The user ID to check for mutual follows
 */
async function calculateMutualsCount(userId: string): Promise<number> {
	const followerRel = aliasedTable(userRelationship, 'follower');
	const followingRel = aliasedTable(userRelationship, 'following');

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
				eq(followingRel.type, 'FOLLOW'),
				// This person follows the current user
				eq(followerRel.toId, userId),
				eq(followerRel.type, 'FOLLOW')
			)
		);

	return result[0]?.count ?? 0;
}

/**
 * Gets relationship counts for a user
 * @param userId The user ID to get counts for
 */
async function getUserRelationshipCounts(userId: string): Promise<{
	followersCount: number;
	followingCount: number;
	blockedCount: number;
	blockersCount: number;
	mutingCount: number;
	mutersCount: number;
	requestsCount: number;
	mutualsCount: number;
}> {
	// Batch fetch all relationship counts in parallel
	const [
		followersCount,
		followingCount,
		blockedCount,
		blockersCount,
		mutingCount,
		mutersCount,
		requestsCount,
		mutualsCount
	] = await Promise.all([
		getRelationshipCount(userId, 'FOLLOW', true),
		getRelationshipCount(userId, 'FOLLOW', false),
		getRelationshipCount(userId, 'BLOCK', false),
		getRelationshipCount(userId, 'BLOCK', true),
		getRelationshipCount(userId, 'MUTE', false),
		getRelationshipCount(userId, 'MUTE', true),
		getRelationshipCount(userId, 'REQUEST', true),
		calculateMutualsCount(userId)
	]);

	return {
		followersCount,
		followingCount,
		blockedCount,
		blockersCount,
		mutingCount,
		mutersCount,
		requestsCount,
		mutualsCount
	};
}

/**
 * Gets relationship statuses between a target user and the authenticated user
 * @param targetUserId The target user ID
 * @param currentUserId The authenticated user ID
 */
async function getUserRelationshipStatuses(
	targetUserId: string,
	currentUserId: string | undefined
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
			isRequested: false
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
					eq(userRelationship.toId, targetUserId)
				)
			),

		// Target user -> Current user relationships
		db
			.select({ type: userRelationship.type })
			.from(userRelationship)
			.where(
				and(
					eq(userRelationship.fromId, targetUserId),
					eq(userRelationship.toId, currentUserId)
				)
			)
	];

	const [outgoing, incoming] = await Promise.all(relationshipPromises);

	// Create maps for faster lookups
	const outgoingRelations = new Set(outgoing?.map((r) => r.type));
	const incomingRelations = new Set(incoming?.map((r) => r.type));

	return {
		isFollowing: outgoingRelations.has('FOLLOW'),
		isFollower: incomingRelations.has('FOLLOW'),
		isBlocking: outgoingRelations.has('BLOCK'),
		isBlocked: incomingRelations.has('BLOCK'),
		isMuting: outgoingRelations.has('MUTE'),
		isRequesting: outgoingRelations.has('REQUEST'),
		isRequested: incomingRelations.has('REQUEST')
	};
}

/**
 * Retrieves complete relationship statistics for a user
 * @param userId The user ID to get statistics for
 * @param currentUserId The authenticated user ID (if available)
 */
async function getCompleteRelationshipStats(
	userId: string,
	currentUserId: string | undefined
): Promise<{
	followersCount: number;
	followingCount: number;
	blockedCount: number;
	blockersCount: number;
	mutingCount: number;
	mutersCount: number;
	requestsCount: number;
	mutualsCount: number;
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
		getUserRelationshipStatuses(userId, currentUserId)
	]);

	return {
		...counts,
		...statuses
	};
}

export { UserRelationshipStats, getCompleteRelationshipStats };
