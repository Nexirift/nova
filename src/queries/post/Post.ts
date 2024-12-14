import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
import { throwError } from '../../helpers/common';
import { Post } from '../../types';

builder.queryField('getPost', (t) =>
	t.field({
		type: Post,
		args: {
			id: t.arg.string({ required: true })
		},
		resolve: async (_root, { id }, ctx: Context) => {
			const post = await db.query.post.findFirst({
				where: (post, { eq }) => eq(post.id, id!)
			});

			if (!post) {
				return throwError('Post not found.', 'POST_NOT_FOUND');
			}

			return post;
		}
	})
);
