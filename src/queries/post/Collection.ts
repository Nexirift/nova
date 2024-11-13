import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
import { PostCollection } from '../../types/post/collection/Collection';

builder.queryField('getPostCollection', (t) =>
	t.field({
		type: PostCollection,
		args: {
			id: t.arg.string({ required: true })
		},
		resolve: async (_root, { id }, ctx: Context) => {
			const postCollection = await db.query.postCollection.findFirst({
				where: (postCollection, { eq }) => eq(postCollection.id, id!)
			});

			if (!postCollection) {
				throw new GraphQLError('Post collection not found.', {
					extensions: { code: 'POST_COLLECTION_NOT_FOUND' }
				});
			}

			return postCollection;
		}
	})
);
