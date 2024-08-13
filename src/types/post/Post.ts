import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type Post as PostType } from '../../drizzle/schema';
import { privacyGuardian } from '../../lib/guardian';
import { redisClient } from '../../redis';
import { User } from '../user';
import { Context } from '../../context';
import { PostInteraction } from './Interaction';
import { PostPoll } from './Poll';
import { PostGiveaway } from './Giveaway';
import { PostMedia } from './Media';

export const Post = builder.objectRef<PostType>('Post');

Post.implement({
	fields: (t) => ({
		id: t.exposeString('id'),
		author: t.field({
			type: User,
			resolve: async (post) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, post.authorId)
				});
				return result!;
			}
		}),
		parent: t.field({
			type: Post,
			resolve: async (parent) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, parent.parentId!)
				});
				return result!;
			},
			nullable: true
		}),
		replies: t.field({
			type: [Post],
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
			authScopes: async (parent, _args, context, _info) => {
				const user = await getUser(parent.authorId, context.oidc.sub);
				return privacyGuardian(user, context);
			},
			unauthorizedResolver: () => null,
			nullable: true
		}),
		media: t.field({
			type: [PostMedia],
			resolve: async (post) => {
				const result = await db.query.postMedia.findMany({
					where: (media, { eq }) => eq(media.postId, post.id)
				});
				return result!;
			}
		}),
		published: t.exposeBoolean('published'),
		pinned: t.exposeBoolean('pinned'),
		hidden: t.exposeBoolean('hidden'),
		interactions: t.field({
			type: [PostInteraction],
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' }),
				type: t.arg({ type: 'String' })
			},
			authScopes: async (parent, _args, context, _info) => {
				const user = await getUser(parent.authorId, context.oidc.sub);
				return privacyGuardian(user, context);
			},
			unauthorizedResolver: () => [],
			resolve: async (post, args, context: Context) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq, ne }) =>
						and(
							eq(postInteraction.postId, post.id),
							ne(postInteraction.type, 'BOOKMARK')
						),
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
						context.oidc.sub
					);
					const check = await privacyGuardian(user, context);

					if (check) {
						finalResult.push(postInteraction);
					}
				}

				return finalResult;
			}
		}),
		poll: t.field({
			type: PostPoll,
			resolve: async (post) => {
				const result = await db.query.postPoll.findFirst({
					where: (postPoll, { eq }) => eq(postPoll.postId, post.id)
				});
				return result!;
			},
			nullable: true
		}),
		giveaway: t.field({
			type: PostGiveaway,
			resolve: async (post) => {
				const result = await db.query.postGiveaway.findFirst({
					where: (postGiveaway, { eq }) =>
						eq(postGiveaway.postId, post.id)
				});
				return result!;
			},
			nullable: true
		}),
		createdAt: t.expose('createdAt', { type: 'Date' }),
		updatedAt: t.expose('updatedAt', { type: 'Date' }),
		bookmarked: t.field({
			type: 'Boolean',
			resolve: async (parent, _args, context: Context) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.postId, parent.id),
							eq(postInteraction.userId, context.oidc.sub),
							eq(postInteraction.type, 'BOOKMARK')
						)
				});
				return result!.length > 0;
			}
		}),
		liked: t.field({
			type: 'Boolean',
			resolve: async (parent, _args, context: Context) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.postId, parent.id),
							eq(postInteraction.userId, context.oidc.sub),
							eq(postInteraction.type, 'LIKE')
						)
				});
				return result!.length > 0;
			}
		}),
		likesCount: t.field({
			type: 'Int',
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
		bookmarksCount: t.field({
			type: 'Int',
			resolve: async (parent) => {
				const result = await db.query.postInteraction.findMany({
					where: (postInteraction, { and, eq }) =>
						and(
							eq(postInteraction.postId, parent.id),
							eq(postInteraction.type, 'BOOKMARK')
						)
				});
				return result!.length ?? 0;
			}
		}),
		/* TODO: IMPLEMENT */
		repostsCount: t.field({
			type: 'Int',
			resolve: () => 5483958
		}),
		repliesCount: t.field({
			type: 'Int',
			resolve: async (parent) => {
				const result = await db.query.post.findMany({
					where: (post, { eq }) => eq(post.parentId, parent.id)
				});
				return result!.length ?? 0;
			}
		}),
		/* TODO: IMPLEMENT */
		reposted: t.field({
			type: 'Boolean',
			resolve: () => false
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
		throw new GraphQLError('User not found.', {
			extensions: { code: 'USER_NOT_FOUND' }
		});
	}

	// Cache user data for 5 seconds
	await redisClient.setEx(cacheKey, 5, JSON.stringify(user));

	return user;
}
