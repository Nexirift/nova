import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
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
				throw new GraphQLError('Post not found.', {
					extensions: { code: 'POST_NOT_FOUND' }
				});
			}

			return post;
		}
	})
);
