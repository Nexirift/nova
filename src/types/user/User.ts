import type { UserSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { Organisation, OrganisationMember } from '..';
import { builder } from '../../builder';
import type { Context } from '../../context';
import { privacyGuardian } from '../../lib/guardian';
import { Post } from '../post';
import { PostInteraction } from '../post/Interaction';
import { PostMedia } from '../post/Media';
import { UserProfileField } from './ProfileField';
import { UserRelationship } from './Relationship';
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
		bio: t.exposeString('bio', { nullable: true }),
		extendedBio: t.exposeString('extendedBio', { nullable: true }),
		avatar: t.exposeString('avatar', { nullable: true }),
		banner: t.exposeString('banner', { nullable: true }),
		background: t.exposeString('background', { nullable: true }),
		type: t.expose('type', { type: UserType, nullable: true }),
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
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user) => {
				const result = await db.query.userProfileField.findMany({
					where: (userProfileField, { eq }) =>
						eq(userProfileField.userId, user.id),
					orderBy: (userProfileField, { asc }) => [
						asc(userProfileField.createdAt)
					]
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
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' })
			},
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user, args) => {
				const result = await db.query.post.findMany({
					where: (post, { and, eq, isNull }) =>
						and(
							eq(post.authorId, user.id),
							isNull(post.parentId),
							eq(post.deleted, false),
							eq(post.published, true)
						),
					limit: args.first!,
					offset: args.offset!
				});
				return result!;
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
				const result = await db.query.post.findMany({
					where: (post, { and, eq, isNotNull }) =>
						and(
							eq(post.authorId, user.id),
							isNotNull(post.parentId),
							eq(post.deleted, false),
							eq(post.published, true)
						),
					limit: args.first!,
					offset: args.offset!
				});
				return result!;
			}
		}),
		media: t.field({
			type: [PostMedia],
			nullable: true,
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user) => {
				const result = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.authorId, user.id),
					with: {
						media: true
					}
				});

				const filteredResult: (typeof PostMedia.$inferType)[] = [];

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
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			unauthorizedResolver: () => [],
			resolve: async (user, args, context: Context) => {
				const type = args.type! as 'LIKE' | 'REPOST';

				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						user.id === context.auth?.user.id
							? and(
									eq(postInteraction.userId, user.id),
									type && eq(postInteraction.type, type)
								)
							: and(
									eq(postInteraction.userId, user.id),
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
			authScopes: (parent, _args, context) =>
				privacyGuardian(parent, context.auth),
			unauthorizedResolver: () => [],
			resolve: async (user, args, context: Context) => {
				const to = await db.query.userRelationship.findMany({
					where: (userRelationship, { eq, and, or }) =>
						and(
							eq(userRelationship.toId, user.id),
							user.id === context.auth?.user.id
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
						context.auth?.user.id === user.id
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
							eq(userRelationship.fromId, context.auth?.user.id),
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
							eq(userRelationship.toId, context.auth?.user.id),
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
							eq(userRelationship.fromId, context.auth?.user.id),
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
							eq(userRelationship.toId, context.auth?.user.id),
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
							eq(userRelationship.fromId, context.auth?.user.id),
							eq(userRelationship.type, 'REQUEST')
						)
				});
				return result!.length > 0;
			}
		})
	})
});
