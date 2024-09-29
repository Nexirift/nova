import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
import { Post } from '../../types';
import {
	post,
	postEditHistory,
	postInteraction,
	PostInteraction as PostInteractionSchema
} from '../../drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { PostInteraction } from '../../types/post/Interaction';
import { privacyGuardian } from '../../lib/guardian';

builder.mutationField('createPost', (t) =>
	t.field({
		type: Post,
		args: {
			content: t.arg.string({ required: true }),
			published: t.arg.boolean({ defaultValue: false }),
			parent: t.arg.string(),
			quote: t.arg.boolean({ defaultValue: false })
		},
		resolve: async (_root, args, ctx: Context) => {
			const createPost = await db
				.insert(post)
				.values({
					content: args.content,
					published: args.published ?? false,
					parentId: args.parent,
					authorId: ctx.oidc.sub,
					quoted: args.quote ?? false
				})
				.returning()
				.execute();

			return createPost[0];
		}
	})
);

builder.mutationField('updatePost', (t) =>
	t.field({
		type: Post,
		args: {
			id: t.arg.string({ required: true }),
			content: t.arg.string({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			const originalPost = await db.query.post.findFirst({
				where: (post, { eq }) => eq(post.id, args.id)
			});

			if (!originalPost) {
				throw new GraphQLError('Post not found.', {
					extensions: { code: 'POST_NOT_FOUND' }
				});
			}

			const updatedPost = await db
				.update(post)
				.set({
					content: args.content
				})
				.where(eq(post.id, args.id))
				.returning()
				.execute();

			if (updatedPost) {
				await db.insert(postEditHistory).values({
					postId: originalPost.id,
					content: originalPost.content,
					createdAt: originalPost.createdAt
				});
			}

			return updatedPost[0];
		}
	})
);

builder.mutationField('deletePost', (t) =>
	t.field({
		type: 'Boolean',
		args: {
			id: t.arg.string({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			const originalPost = await db.query.post.findFirst({
				where: (post, { eq }) => eq(post.id, args.id)
			});

			if (!originalPost) {
				throw new GraphQLError('Post not found.', {
					extensions: { code: 'POST_NOT_FOUND' }
				});
			}

			await db
				.update(post)
				.set({ deleted: true })
				.where(eq(post.id, args.id))
				.execute();

			return true;
		}
	})
);

// Define the possible interaction types
const interactionTypes = [
	'LIKE',
	'UNLIKE',
	'BOOKMARK',
	'UNBOOKMARK',
	'REPOST',
	'UNREPOST'
] as const;

// Create mutation fields for each interaction type
interactionTypes.forEach((type) => {
	builder.mutationField(`${type.toLowerCase()}Post`, (t) =>
		t.field({
			type: PostInteraction,
			args: {
				id: t.arg.string({ required: true }),
				reason: t.arg.string()
			},
			// TODO: Add auth scope.
			resolve: async (_root, args, ctx: Context) =>
				postInteract(ctx, args, type)
		})
	);
});

async function postInteract(
	ctx: Context,
	args: { id: string; reason?: string | null },
	type: 'LIKE' | 'UNLIKE' | 'BOOKMARK' | 'UNBOOKMARK' | 'REPOST' | 'UNREPOST'
): Promise<PostInteractionSchema | null> {
	// Check if ID is provided
	if (!args.id) {
		throw new GraphQLError('You must provide an ID.', {
			extensions: { code: 'MISSING_ID' }
		});
	}

	const post = await db.query.post.findFirst({
		where: (post, { eq }) => eq(post.id, args.id),
		with: {
			author: true
		}
	});

	if (!post) {
		throw new GraphQLError('Post not found.', {
			extensions: { code: 'POST_NOT_FOUND' }
		});
	}

	if ((await privacyGuardian(post.author, ctx)) === false) {
		throw new GraphQLError('You cannot interact with this post.', {
			extensions: { code: 'POST_PRIVACY' }
		});
	}

	// Map interaction types to their corresponding database values
	const interactionMap = {
		LIKE: 'LIKE',
		UNLIKE: 'UNLIKE',
		BOOKMARK: 'BOOKMARK',
		UNBOOKMARK: 'BOOKMARK',
		REPOST: 'REPOST',
		UNREPOST: 'REPOST'
	};

	// Map error messages for each interaction type
	const errorMap = {
		LIKE: 'You have already liked this post.',
		UNLIKE: 'You are not currently liking this post.',
		BOOKMARK: 'You have already bookmarked this post.',
		UNBOOKMARK: 'You are not currently bookmarking this post.',
		REPOST: 'You have already reposted this post.',
		UNREPOST: 'You are not currently reposting this post.'
	};

	const requestedType = interactionMap[type];

	const existingInteraction = await db.query.postInteraction.findFirst({
		where: (postInteraction, { and }) =>
			and(
				eq(postInteraction.userId, ctx.oidc.sub),
				eq(postInteraction.postId, args.id),
				eq(
					postInteraction.type,
					requestedType.replace('UN', '') as
						| 'LIKE'
						| 'BOOKMARK'
						| 'REPOST'
				)
			)
	});

	// Handle LIKE, BOOKMARK, REPOST actions
	if (['LIKE', 'BOOKMARK', 'REPOST'].includes(type)) {
		if (existingInteraction) {
			throw new GraphQLError(errorMap[type], {
				extensions: { code: `POST_ALREADY_${type}ED` }
			});
		}
		return db
			.insert(postInteraction)
			.values({
				userId: ctx.oidc.sub,
				postId: args.id,
				type: type as 'LIKE' | 'BOOKMARK' | 'REPOST'
			})
			.returning()
			.then((res) => res[0]);
	} else {
		if (!existingInteraction) {
			throw new GraphQLError(errorMap[type], {
				extensions: { code: `POST_NOT_${type}ED` }
			});
		}

		return db
			.delete(postInteraction)
			.where(
				and(
					eq(postInteraction.userId, ctx.oidc.sub),
					eq(postInteraction.postId, args.id),
					eq(
						postInteraction.type,
						type.replace('UN', '') as 'LIKE' | 'BOOKMARK' | 'REPOST'
					)
				)
			)
			.returning()
			.then((res) => res[0]);
	}
}
