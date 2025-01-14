import { User } from '../..';
import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type PostCollectionSchemaType } from '../../../drizzle/schema';
import { throwError } from '../../../helpers/common';
import { PostCollectionItem } from './Item';

export const PostCollectionVisibilityType = builder.enumType(
	'PostCollectionVisibilityType',
	{
		values: ['PUBLIC', 'PRIVATE']
	}
);

export const PostCollection =
	builder.objectRef<PostCollectionSchemaType>('PostCollection');

PostCollection.implement({
	authScopes: async (_parent, context) => {
		if (
			_parent.visibility === 'PRIVATE' &&
			context.oidc?.sub !== _parent.userId
		) {
			return throwError('You cannot view this post.', 'UNAUTHORIZED');
		}
		return true;
	},
	runScopesOnType: true,
	fields: (t) => ({
		id: t.exposeString('id', { nullable: false }),
		name: t.exposeString('name', { nullable: false }),
		description: t.exposeString('description', { nullable: true }),
		visibility: t.expose('visibility', {
			type: PostCollectionVisibilityType,
			nullable: false
		}),
		user: t.field({
			type: User,
			nullable: false,
			resolve: async (postCollection) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, postCollection.userId)
				});
				return result!;
			}
		}),
		items: t.field({
			type: [PostCollectionItem],
			nullable: true,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' })
			},
			resolve: async (parent, args) => {
				const result = await db.query.postCollectionItem.findMany({
					where: (postCollection, { eq }) =>
						eq(postCollection.collectionId, parent.id),
					limit: args.first!,
					offset: args.offset!,
					with: {
						post: true
					}
				});
				return result!;
			}
		})
	})
});
