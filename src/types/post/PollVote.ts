import { User } from '..';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type PostPollVote as PostPollVoteType } from '../../drizzle/schema';
import { Post } from './Post';

export const PostPollVote = builder.objectRef<PostPollVoteType>('PostPollVote');

PostPollVote.implement({
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
