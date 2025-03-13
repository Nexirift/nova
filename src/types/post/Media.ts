import type { PostMediaSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { Post } from './Post';

export const PostMedia = builder.objectRef<PostMediaSchemaType>('PostMedia');

PostMedia.implement({
	fields: (t) => ({
		id: t.exposeString('id'),
		post: t.field({
			type: Post,
			resolve: async (_post) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, _post.postId ?? '')
				});
				return result!;
			}
		}),
		url: t.exposeString('url'),
		createdAt: t.expose('createdAt', { type: 'Date' })
	})
});
