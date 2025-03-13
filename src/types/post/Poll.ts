import type { PostPollSchemaType, PostPollVoteSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { config } from '../../config';
import { throwFeatureDisabledError } from '../../helpers/common';
import { Post } from './Post';

export const PostPoll = builder.objectRef<PostPollSchemaType>('PostPoll');

PostPoll.implement({
	authScopes: async () => {
		if (
			!config.features.posts.polls.enabled ||
			!config.features.posts.enabled
		)
			return throwFeatureDisabledError();

		return true;
	},
	fields: (t) => ({
		post: t.field({
			type: Post,
			nullable: false,
			resolve: async (_post) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, _post.postId)
				});
				return result!;
			}
		}),
		options: t.field({
			type: ['String'],
			nullable: false,
			resolve: async (poll) => poll.options!.toString().split(',')
		}),
		finish: t.expose('finish', { type: 'Date', nullable: false })
	})
});

export const PostPollVote =
	builder.objectRef<PostPollVoteSchemaType>('PostPollVote');

PostPollVote.implement({
	authScopes: async () => {
		if (!config.features.posts.polls.enabled)
			return throwFeatureDisabledError();

		return true;
	},
	fields: (t) => ({
		post: t.field({
			type: Post,
			nullable: false,
			resolve: async (_post) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, _post.postId)
				});
				return result!;
			}
		}),
		option: t.exposeString('option', { nullable: false })
	})
});
