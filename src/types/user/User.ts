import type { UserSchemaType } from '@nexirift/db';
import { db, post, postInteraction, userRelationship } from '@nexirift/db';
import { and, count, eq } from 'drizzle-orm';
import { Organization, OrganizationMember, UserProfile } from '..';
import { builder } from '../../builder';
import type { Context } from '../../context';
import {
	getCompleteRelationshipStats,
	UserRelationshipStats
} from '../../helpers/user/Relationship';
import { privacyGuardian } from '../../lib/guardian';
import { Post } from '../post';
import { PostInteraction } from '../post/Interaction';
import { PostMedia } from '../post/Media';
import {
	UserRelationship,
	UserRelationshipType,
	UserRelatonshipDirection
} from './Relationship';
import { UserVerification } from './Verification';

export const UserType = builder.enumType('UserType', {
	values: ['PUBLIC', 'PRIVATE']
});

export const User = builder.objectRef<UserSchemaType>('User');

User.implement({
	fields: (t) => ({
		id: t.exposeString('id', {
			nullable: false
		}),
		username: t.exposeString('displayUsername'),
		displayName: t.exposeString('displayName', { nullable: true }),
		avatar: t.exposeString('avatar', { nullable: true }),
		type: t.expose('type', { type: UserType, nullable: true }),
		verification: t.field({
			type: UserVerification,
			nullable: true,
			resolve: async (user) => {
				return await db.query.userVerification.findFirst({
					where: (userVerification, { eq }) =>
						eq(userVerification.userId, user.id)
				});
			}
		}),
		profile: t.field({
			type: UserProfile,
			nullable: true,
			authScopes: (parent, _args, context) =>
				privacyGuardian({ id: parent.id }, context.auth),
			unauthorizedResolver: () => null,
			resolve: async (user) => {
				return await db.query.userProfile.findFirst({
					where: (userProfile, { eq }) =>
						eq(userProfile.userId, user.id)
				});
			}
		}),
		organizations: t.field({
			type: [OrganizationMember],
			nullable: true,
			resolve: async (user) => {
				return await db.query.organizationMember.findMany({
					where: (organization, { eq }) =>
						eq(organization.userId, user.id)
				});
			}
		}),
		organization: t.field({
			type: Organization,
			nullable: true,
			resolve: async (user) => {
				const member = await db.query.organizationMember.findFirst({
					where: (organizationMember, { and, eq }) =>
						and(
							eq(organizationMember.userId, user.id),
							eq(organizationMember.role, 'owner')
						)
				});

				if (!member) return null;

				const org = await db.query.organization.findFirst({
					where: (organization, { eq }) =>
						eq(organization.id, member.organizationId)
				});

				return org;
			}
		}),
		posts: t.field({
			type: [Post],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' })
			},
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user, args) => {
				const { first = 10, offset = 0 } = args;
				return await db.query.post.findMany({
					where: (post, { and, eq, isNull }) =>
						and(
							eq(post.authorId, user.id),
							isNull(post.parentId),
							eq(post.deleted, false),
							eq(post.published, true)
						),
					limit: first ?? 10,
					offset: offset ?? 0
				});
			}
		}),
		replies: t.field({
			type: [Post],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' })
			},
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user, args) => {
				const { first = 10, offset = 0 } = args;
				return await db.query.post.findMany({
					where: (post, { and, eq, isNotNull }) =>
						and(
							eq(post.authorId, user.id),
							isNotNull(post.parentId),
							eq(post.deleted, false),
							eq(post.published, true)
						),
					limit: first ?? 10,
					offset: offset ?? 0
				});
			}
		}),
		media: t.field({
			type: [PostMedia],
			nullable: true,
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user) => {
				const posts = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.authorId, user.id),
					with: {
						media: true
					}
				});

				return posts.flatMap((post) => post.media || []);
			}
		}),
		interactions: t.field({
			type: [PostInteraction],
			nullable: true,
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			unauthorizedResolver: () => [],
			resolve: async (user, args) => {
				const { first = 10, offset = 0, type } = args;
				const interactionType = type as 'LIKE' | 'REPOST' | undefined;

				return await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) => {
						const conditions = [
							eq(postInteraction.userId, user.id)
						];

						if (interactionType) {
							conditions.push(
								eq(postInteraction.type, interactionType)
							);
						}

						return and(...conditions);
					},
					with: {
						post: true
					},
					limit: first ?? 10,
					offset: offset ?? 0
				});
			}
		}),
		relationships: t.field({
			type: [UserRelationship],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				after: t.arg({ type: 'Int' }),
				type: t.arg({ type: UserRelationshipType }),
				direction: t.arg({
					type: UserRelatonshipDirection
				})
			},
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user, args, context: Context) => {
				// Privacy check was already done via authScopes
				const { type, direction, first = 10, after = 0 } = args;
				const isIncoming = direction === 'INCOMING';
				const isAuthenticatedUser = user.id === context.auth?.user?.id;

				// Security check for sensitive relationship types
				const isSensitiveType = type === 'BLOCK' || type === 'MUTE';
				if (
					(isSensitiveType && (isIncoming || !isAuthenticatedUser)) ||
					(type === 'REQUEST' && !isAuthenticatedUser)
				) {
					return [];
				}

				// Determine which ID to use in the query based on direction
				const directionCondition = isIncoming
					? eq(userRelationship.toId, user.id)
					: eq(userRelationship.fromId, user.id);

				return await db.query.userRelationship.findMany({
					where: (userRelationship, { eq, and }) => {
						return type
							? and(
									directionCondition,
									eq(userRelationship.type, type)
								)
							: directionCondition;
					},
					with: {
						// Only load the needed relationship direction
						from: isIncoming ? true : undefined,
						to: !isIncoming ? true : undefined
					},
					limit: first ?? 10,
					offset: after ?? 0
				});
			}
		}),
		relationshipStats: t.field({
			type: UserRelationshipStats,
			resolve: async (user, _, ctx) =>
				await getCompleteRelationshipStats(user.id, ctx.auth?.user?.id)
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false }),
		updatedAt: t.expose('updatedAt', { type: 'Date', nullable: false }),
		likesCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db
					.select({ count: count() })
					.from(postInteraction)
					.where(
						and(
							eq(postInteraction.userId, user.id),
							eq(postInteraction.type, 'LIKE')
						)
					);
				return result[0]?.count ?? 0;
			}
		}),
		postsCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db
					.select({ count: count() })
					.from(post)
					.where(eq(post.authorId, user.id));
				return result[0]?.count ?? 0;
			}
		}),
		attributes: t.stringList({
			resolve: (p) => {
				try {
					return JSON.parse(p.attributes ?? '[]') ?? [];
				} catch {
					return [];
				}
			},
			nullable: false
		})
	})
});
