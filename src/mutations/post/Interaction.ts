import type { PostInteractionSchemaType } from '@nexirift/db';
import { db, postInteraction } from '@nexirift/db';
import { and, eq } from 'drizzle-orm';
import { builder } from '../../builder';
import type { Context } from '../../context';
import { throwError } from '../../helpers/common';
import { privacyGuardian } from '../../lib/guardian';
import { PostInteraction } from '../../types/post/Interaction';

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
			authScopes: { loggedIn: true },
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
	const post = await db.query.post.findFirst({
		where: (post, { eq }) => eq(post.id, args.id),
		with: {
			author: true
		}
	});

	if (!post) {
		return throwError('Post not found.', 'POST_NOT_FOUND');
	}

	if ((await privacyGuardian(post.author, ctx.auth)) === false) {
		return throwError(
			'You cannot interact with this post.',
			'POST_PRIVACY'
		);
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
				eq(postInteraction.userId, ctx.auth?.user?.id),
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
			return throwError(errorMap[type], `POST_ALREADY_${type}ED`);
		}
		const result = await db
			.insert(postInteraction)
			.values({
				userId: ctx.auth?.user?.id,
				postId: args.id,
				type: type as 'LIKE' | 'REPOST'
			})
			.returning();
		return result[0] || null;
	} else {
		if (!existingInteraction) {
			return throwError(
				errorMap[type],
				`POST_NOT_${
					type.startsWith('UN') ? type.replace('UN', '') : type
				}ED`
			);
		}

		const result = await db
			.delete(postInteraction)
			.where(
				and(
					eq(postInteraction.userId, ctx.auth?.user?.id),
					eq(postInteraction.postId, args.id),
					eq(
						postInteraction.type,
						type.replace('UN', '') as 'LIKE' | 'REPOST'
					)
				)
			)
			.returning();
		return result[0] || null;
	}
}
