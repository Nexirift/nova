import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
import { type UserSchemaType } from '../../drizzle/schema';
import { privacyGuardian } from '../../lib/guardian';
import { Post } from '../post';
import { UserRelationship } from './Relationship';
import { UserVerification } from './Verification';
import { redisClient } from '../../redis';
import { PostInteraction } from '../post/Interaction';
import { UserProfileField } from './ProfileField';
import { Organisation, OrganisationMember } from '..';
import { PostMedia } from '../post/Media';

export const User = builder.objectRef<UserSchemaType>('User');

User.implement({
	fields: (t) => ({
		id: t.exposeString('id', {
			nullable: false
		}),
		username: t.exposeString('username', {
			nullable: false
		}),
		displayName: t.exposeString('displayName', { nullable: true }),
		bio: t.exposeString('bio', { nullable: true }),
		extendedBio: t.exposeString('extendedBio', { nullable: true }),
		avatar: t.exposeString('avatar', { nullable: true }),
		banner: t.exposeString('banner', { nullable: true }),
		background: t.exposeString('background', { nullable: true }),
		type: t.exposeString('type', { nullable: true }),
		verification: t.field({
			type: UserVerification,
			nullable: true,
			resolve: async (user) => {
				const result = await db.query.userVerification.findFirst({
					where: (userVerification, { eq }) =>
						eq(userVerification.userId, user.id)
				});
				return result!;
			}
		}),
		profession: t.exposeString('profession', { nullable: true }),
		location: t.exposeString('location', { nullable: true }),
		website: t.exposeString('website', { nullable: true }),
		profileFields: t.field({
			type: [UserProfileField],
			nullable: true,
			authScopes: (parent, _args, context, _info) =>
				privacyGuardian(parent, context),
			unauthorizedResolver: () => [] as any,
			resolve: async (user) => {
				const result = await db.query.userProfileField.findMany({
					where: (userProfileField, { eq }) =>
						eq(userProfileField.userId, user.id)
				});
				return result!;
			}
		}),
		organisations: t.field({
			type: [OrganisationMember],
			nullable: true,
			resolve: async (user) => {
				const result = await db.query.organisationMember.findMany({
					where: (organisation, { eq }) =>
						eq(organisation.userId, user.id)
				});
				return result!;
			}
		}),
		organisation: t.field({
			type: Organisation,
			nullable: true,
			resolve: async (user) => {
				const result = await db.query.organisation.findFirst({
					where: (organisation, { eq }) =>
						eq(organisation.accountId, user.id)
				});
				return result!;
			}
		}),
		posts: t.field({
			type: [Post],
			nullable: true,
			authScopes: (parent, _args, context, _info) =>
				privacyGuardian(parent, context),
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			unauthorizedResolver: () => [] as any,
			resolve: async (user, args) => {
				const result = await db.query.post.findMany({
					where: (post, { and, eq, isNull, isNotNull }) =>
						args.type === 'POST'
							? and(
									eq(post.authorId, user.id),
									isNull(post.parentId)
							  )
							: args.type === 'REPLY'
							? and(
									eq(post.authorId, user.id),
									isNotNull(post.parentId)
							  )
							: eq(post.authorId, user.id)
				});
				return result!;
			}
		}),
		media: t.field({
			type: [PostMedia],
			nullable: true,
			authScopes: (parent, _args, context, _info) =>
				privacyGuardian(parent, context),
			unauthorizedResolver: () => [] as any,
			resolve: async (user) => {
				const result = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.authorId, user.id),
					with: {
						media: true
					}
				});

				var filteredResult: (typeof PostMedia.$inferType)[] = [];

				result.forEach((post) => {
					if (post?.media) {
						for (const media of post.media) {
							filteredResult.push(media);
						}
					}
				});
				return filteredResult;
			}
		}),
		interactions: t.field({
			type: [PostInteraction],
			nullable: true,
			authScopes: (parent, _args, context, _info) =>
				privacyGuardian(parent, context),
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			unauthorizedResolver: () => [] as any,
			resolve: async (user, args, context: Context) => {
				const type = args.type! as 'LIKE' | 'BOOKMARK' | 'REPOST';

				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq, ne }) =>
						user.id === context.oidc?.sub
							? and(
									eq(postInteraction.userId, user.id),
									type && eq(postInteraction.type, type)
							  )
							: and(
									eq(postInteraction.userId, user.id),
									ne(postInteraction.type, 'BOOKMARK'),
									type && eq(postInteraction.type, type)
							  ),
					with: {
						post: true
					},
					limit: args.first!,
					offset: args.offset!
				});
				return result;
			}
		}),
		relationships: t.field({
			type: [UserRelationship],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				after: t.arg({ type: 'Int' })
			},
			authScopes: (parent, _args, context, _info) =>
				privacyGuardian(parent, context),
			unauthorizedResolver: () => [] as any,
			resolve: async (user, args, context: Context) => {
				const to = await db.query.userRelationship.findMany({
					where: (userRelationship, { eq, and, or }) =>
						and(
							eq(userRelationship.toId, user.id),
							user.id === context.oidc?.sub
								? or(
										eq(userRelationship.type, 'REQUEST'),
										eq(userRelationship.type, 'FOLLOW')
								  )
								: eq(userRelationship.type, 'FOLLOW')
						),
					with: {
						from: true
					},
					limit: args.first!,
					offset: args.after!
				});

				const from = await db.query.userRelationship.findMany({
					where: (userRelationship, { eq, and }) =>
						context.oidc?.sub === user.id
							? eq(userRelationship.fromId, user.id)
							: and(
									eq(userRelationship.fromId, user.id),
									eq(userRelationship.type, 'FOLLOW')
							  ),
					with: {
						to: true
					},
					limit: args.first!,
					offset: args.after!
				});

				return [...to, ...from].slice(args.after!, args.first!);
			}
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false }),
		updatedAt: t.expose('updatedAt', { type: 'Date', nullable: false }),
		bookmarksCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.userId, user.id),
							eq(postInteraction.type, 'BOOKMARK')
						)
				});
				return result!.length ?? 0;
			}
		}),
		likesCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.userId, user.id),
							eq(postInteraction.type, 'LIKE')
						)
				});
				return result!.length ?? 0;
			}
		}),
		postsCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.authorId, user.id)
				});
				return result!.length ?? 0;
			}
		}),
		followingCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { eq }) =>
						eq(userRelationship.fromId, user.id)
				});
				return result!.length ?? 0;
			}
		}),
		followersCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (user) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { eq }) =>
						eq(userRelationship.toId, user.id)
				});
				return result!.length ?? 0;
			}
		}),
		isBlocking: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (user, _args, context: Context) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { and, eq }) =>
						and(
							eq(userRelationship.toId, user.id),
							eq(userRelationship.fromId, context.oidc?.sub),
							eq(userRelationship.type, 'BLOCK')
						)
				});
				return result!.length > 0;
			}
		}),
		isBlocked: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (user, _args, context: Context) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { and, eq }) =>
						and(
							eq(userRelationship.fromId, user.id),
							eq(userRelationship.toId, context.oidc?.sub),
							eq(userRelationship.type, 'BLOCK')
						)
				});
				return result!.length > 0;
			}
		}),
		isFollowing: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (user, _args, context: Context) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { and, eq }) =>
						and(
							eq(userRelationship.toId, user.id),
							eq(userRelationship.fromId, context.oidc?.sub),
							eq(userRelationship.type, 'FOLLOW')
						)
				});
				return result!.length > 0;
			}
		}),
		isFollower: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (user, _args, context: Context) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { and, eq }) =>
						and(
							eq(userRelationship.fromId, user.id),
							eq(userRelationship.toId, context.oidc?.sub),
							eq(userRelationship.type, 'FOLLOW')
						)
				});
				return result!.length > 0;
			}
		}),
		hasSentFollowRequest: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (user, _args, context: Context) => {
				const result = await db.query.userRelationship.findMany({
					where: (userRelationship, { and, eq }) =>
						and(
							eq(userRelationship.toId, user.id),
							eq(userRelationship.fromId, context.oidc?.sub),
							eq(userRelationship.type, 'REQUEST')
						)
				});
				return result!.length > 0;
			}
		})
	})
});
