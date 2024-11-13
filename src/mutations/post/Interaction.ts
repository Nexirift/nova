import { eq, and } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import {
	postInteraction,
	PostInteractionSchemaType
} from '../../drizzle/schema';
import { privacyGuardian } from '../../lib/guardian';
import { PostInteraction } from '../../types/post/Interaction';
import { Context } from '../../context';

// Define the possible interaction types
const interactionTypes = ['LIKE', 'UNLIKE', 'REPOST', 'UNREPOST'] as const;

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
	type: 'LIKE' | 'UNLIKE' | 'REPOST' | 'UNREPOST'
): Promise<PostInteractionSchemaType | null> {
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
		REPOST: 'REPOST',
		UNREPOST: 'REPOST'
	};

	// Map error messages for each interaction type
	const errorMap = {
		LIKE: 'You have already liked this post.',
		UNLIKE: 'You are not currently liking this post.',
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
					requestedType.replace('UN', '') as 'LIKE' | 'REPOST'
				)
			)
	});

	// Handle LIKE & REPOST actions
	if (['LIKE', 'REPOST'].includes(type)) {
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
				type: type as 'LIKE' | 'REPOST'
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
						type.replace('UN', '') as 'LIKE' | 'REPOST'
					)
				)
			)
			.returning()
			.then((res) => res[0]);
	}
}
