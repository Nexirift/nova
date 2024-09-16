import { User } from '..';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type PostPoll as PostPollType } from '../../drizzle/schema';
import { Post } from './Post';

export const PostPoll = builder.objectRef<PostPollType>('PostPoll');

PostPoll.implement({
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
