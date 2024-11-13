import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type PostCollectionItemSchemaType } from '../../../drizzle/schema';
import { PostCollection } from './Collection';
import { Post } from '../Post';

export const PostCollectionItem =
	builder.objectRef<PostCollectionItemSchemaType>('PostCollectionItem');

PostCollectionItem.implement({
	fields: (t) => ({
		collection: t.field({
			type: PostCollection,
			nullable: false,
			resolve: async (_postCollection) => {
				const result = await db.query.postCollection.findFirst({
					where: (postCollection, { eq }) =>
						eq(postCollection.id, _postCollection.collectionId)
				});
				return result!;
			}
		}),
		post: t.field({
			type: Post,
			nullable: false,
			resolve: async (_post) => {
				const result = await db.query.post.findFirst({
					where: (post, { eq }) => eq(post.id, _post.postId)
				});
				return result!;
			}
		})
	})
});
