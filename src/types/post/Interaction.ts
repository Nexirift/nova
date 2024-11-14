import { User } from '..';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type PostInteractionSchemaType } from '../../drizzle/schema';
import { Post } from './Post';

export const PostInteractionType = builder.enumType('PostInteractionType', {
	values: ['LIKE', 'REPOST']
});

export const PostInteraction =
	builder.objectRef<PostInteractionSchemaType>('PostInteraction');

PostInteraction.implement({
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
		user: t.field({
			type: User,
			nullable: false,
			resolve: async (_user) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, _user.userId)
				});
				return result!;
			}
		}),
		type: t.expose('type', { type: PostInteractionType, nullable: false })
	})
});
