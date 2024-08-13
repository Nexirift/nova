import { User } from '..';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type PostGiveaway as PostGiveawayType } from '../../drizzle/schema';
import { Post } from './Post';

export const PostGiveaway = builder.objectRef<PostGiveawayType>('PostGiveaway');

PostGiveaway.implement({
	fields: (t) => ({
		post: t.field({
			type: Post,
			resolve: async (_post) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, _post.postId)
				});
				return result!;
			}
		}),
		type: t.exposeString('type'),
		requirements: t.field({
			type: ['String'],
			resolve: async (giveaway) =>
				giveaway.requirements!.toString().split(',')
		}),
		finish: t.expose('finish', { type: 'Date' })
	})
});
