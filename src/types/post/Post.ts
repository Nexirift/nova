import type { PostSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { config } from '../../config';
import type { Context } from '../../context';
import { throwError, throwFeatureDisabledError } from '../../helpers/common';
import { privacyGuardian } from '../../lib/guardian';
import { redisClient } from '../../redis';
import { User } from '../user';
import { PostGiveaway } from './Giveaway';
import { PostInteraction } from './Interaction';
import { PostMedia } from './Media';
import { PostPoll } from './Poll';

export const Post = builder.objectRef<PostSchemaType>('Post');

Post.implement({
	authScopes: async (_parent, context) => {
		if (!config.features.posts.enabled) return throwFeatureDisabledError();

		if (!_parent.published && context.auth?.user.id === _parent.authorId) {
			return throwError('You cannot view this post.', 'UNAUTHORIZED');
		}
		return true;
	},
	runScopesOnType: true,
	fields: (t) => ({
		id: t.exposeString('id', { nullable: false }),
		author: t.field({
			type: User,
			nullable: false,
			resolve: async (post) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, post.authorId)
				});
				return result!;
			}
		}),
		parent: t.field({
			type: Post,
			nullable: true,
			resolve: async (parent) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, parent.parentId!)
				});
				return result!;
			}
		}),
		replies: t.field({
			type: [Post],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			resolve: async (parent, args) => {
				const result = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.parentId, parent.id),
					limit: args.first!,
					offset: args.offset!
				});
				return result!;
			}
		}),
		content: t.exposeString('content', {
			authScopes: async (parent, _args, context) => {
				const user = await getUser(
					parent.authorId,
					context.auth?.user.id
				);
				return privacyGuardian(user, context.auth);
			},
			unauthorizedResolver: () => null
		}),
		media: t.field({
			type: [PostMedia],
			nullable: true,
			resolve: async (post) => {
				const result = await db.query.postMedia.findMany({
					where: (media, { eq }) => eq(media.postId, post.id)
				});
				return result!;
			}
		}),
		published: t.exposeBoolean('published', { nullable: false }),
		pinned: t.exposeBoolean('pinned', { nullable: false }),
		hidden: t.exposeBoolean('hidden', { nullable: false }),
		interactions: t.field({
			type: [PostInteraction],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			authScopes: async (parent, _args, context) => {
				const user = await getUser(
					parent.authorId,
					context.auth?.user.id
				);
				return privacyGuardian(user, context.auth);
			},
			unauthorizedResolver: () => [],
			resolve: async (post, args, context: Context) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { eq }) =>
						eq(postInteraction.postId, post.id),
					with: {
						user: true,
						post: true
					},
					limit: args.first!,
					offset: args.offset!
				});

				const finalResult = [];

				for (const postInteraction of result) {
					const user = await getUser(
						postInteraction.userId,
						context.auth?.user.id
					);
					const check = await privacyGuardian(user, context.auth);

					if (check) {
						finalResult.push(postInteraction);
					}
				}

				return finalResult;
			}
		}),
		poll: t.field({
			type: PostPoll,
			nullable: true,
			resolve: async (post) => {
				const result = await db.query.postPoll.findFirst({
					where: (postPoll, { eq }) => eq(postPoll.postId, post.id)
				});
				return result!;
			}
		}),
		giveaway: t.field({
			type: PostGiveaway,
			nullable: true,
			resolve: async (post) => {
				const result = await db.query.postGiveaway.findFirst({
					where: (postGiveaway, { eq }) =>
						eq(postGiveaway.postId, post.id)
				});
				return result!;
			}
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false }),
		updatedAt: t.expose('updatedAt', { type: 'Date', nullable: false }),
		liked: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (parent, _args, context: Context) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.postId, parent.id),
							eq(postInteraction.userId, context.auth?.user.id),
							eq(postInteraction.type, 'LIKE')
						)
				});
				return result!.length > 0;
			}
		}),
		likesCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (parent) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.postId, parent.id),
							eq(postInteraction.type, 'LIKE')
						)
				});
				return result!.length ?? 0;
			}
		}),
		repostsCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (parent) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.postId, parent.id),
							eq(postInteraction.type, 'REPOST')
						)
				});
				return result!.length ?? 0;
			}
		}),
		repliesCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (parent) => {
				const result = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.parentId, parent.id)
				});
				return result!.length ?? 0;
			}
		}),
		replied: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (parent, _args, context: Context) => {
				const result = await db.query.post.findMany({
					where: (post, { and, eq }) =>
						and(
							eq(post.parentId, parent.id),
							eq(post.authorId, context.auth?.user.id)
						)
				});
				return result!.length > 0;
			}
		}),
		reposted: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (parent, _args, context: Context) => {
				const result = await db.query.postInteraction.findMany({
					where: (post, { and, eq }) =>
						and(
							eq(post.userId, context.auth?.user.id),
							eq(post.postId, parent.id),
							eq(post.type, 'REPOST')
						)
				});
				return result!.length > 0;
			}
		}),
		collectionCount: t.field({
			type: 'Int',
			nullable: false,
			resolve: async (post) => {
				const result = await db.query.postCollectionItem.findMany({
					where: (postCollectionItem, { eq }) =>
						eq(postCollectionItem.postId, post.id)
				});
				return result!.length ?? 0;
			}
		}),
		inCollection: t.field({
			type: 'Boolean',
			nullable: false,
			resolve: async (post, args, context: Context) => {
				const result = await db.query.postCollectionItem.findMany({
					where: (postCollectionItem, { eq }) =>
						eq(postCollectionItem.postId, post.id),
					with: {
						collection: {
							with: {
								user: true
							}
						}
					}
				});

				return result.some(
					(item) => item.collection.user.id === context.auth?.user.id
				);
			}
		})
	})
});

async function getUser(id: string | null, username: string | null) {
	const cacheKey = id ? `user:${id}` : `user:${username}`;

	// Check if user data is cached
	const cachedUser = await redisClient.get(cacheKey);
	if (cachedUser) {
		return JSON.parse(cachedUser);
	}

	const user = await db.query.user.findFirst({
		where: (user, { eq }) =>
			id ? eq(user.id, id!) : eq(user.username, username!)
	});

	if (!user) {
		return throwError('User not found.', 'USER_NOT_FOUND');
	}

	// Cache user data for 5 seconds
	await redisClient.setEx(cacheKey, 5, JSON.stringify(user));

	return user;
}
