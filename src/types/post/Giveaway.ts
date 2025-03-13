import type { PostGiveawaySchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { config } from '../../config';
import { throwFeatureDisabledError } from '../../helpers/common';
import { Post } from './Post';

export const PostGiveaway =
	builder.objectRef<PostGiveawaySchemaType>('PostGiveaway');

PostGiveaway.implement({
	authScopes: async () => {
		if (!config.features.posts.enabled) return throwFeatureDisabledError();

		return true;
	},
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
		type: t.exposeString('type', { nullable: false }),
		requirements: t.field({
			type: ['String'],
			nullable: false,
			resolve: async (giveaway) =>
				giveaway.requirements!.toString().split(',')
		}),
		finish: t.expose('finish', { type: 'Date', nullable: false })
	})
});
