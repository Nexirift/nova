import { db, post, postEditHistory } from '@nexirift/db';
import { eq } from 'drizzle-orm';
import { builder } from '../../builder';
import type { Context } from '../../context';
import { throwError } from '../../helpers/common';
import { Post } from '../../types';

builder.mutationField('createPost', (t) =>
	t.field({
		type: Post,
		args: {
			content: t.arg.string({ required: true }),
			published: t.arg.boolean({ defaultValue: false }),
			parent: t.arg.string(),
			quote: t.arg.boolean({ defaultValue: false })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			// TODO: Implement requireMedia check.

			const createPost = await db
				.insert(post)
				.values({
					content: args.content,
					published: args.published ?? false,
					parentId: args.parent,
					authorId: ctx.auth?.user?.id,
					quoted: args.quote ?? false
				})
				.returning()
				.execute();

			return createPost[0];
		}
	})
);

builder.mutationField('updatePost', (t) =>
	t.field({
		type: Post,
		args: {
			id: t.arg.string({ required: true }),
			content: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args) => {
			const originalPost = await db.query.post.findFirst({
				where: (post, { eq }) => eq(post.id, args.id)
			});

			if (!originalPost) {
				return throwError('Post not found.', 'POST_NOT_FOUND');
			}

			const updatedPost = await db
				.update(post)
				.set({
					content: args.content
				})
				.where(eq(post.id, args.id))
				.returning()
				.execute();

			if (updatedPost) {
				await db.insert(postEditHistory).values({
					postId: originalPost.id,
					content: originalPost.content,
					createdAt: originalPost.createdAt
				});
			}

			return updatedPost[0];
		}
	})
);

builder.mutationField('deletePost', (t) =>
	t.field({
		type: 'Boolean',
		args: {
			id: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args) => {
			const originalPost = await db.query.post.findFirst({
				where: (post, { eq }) => eq(post.id, args.id)
			});

			if (!originalPost) {
				return throwError('Post not found.', 'POST_NOT_FOUND');
			}

			await db
				.update(post)
				.set({ deleted: true })
				.where(eq(post.id, args.id))
				.execute();

			return true;
		}
	})
);
