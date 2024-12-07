import { InferSelectModel, relations } from 'drizzle-orm';
import { pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { citext, post, user } from '..';

export const postInteractionType = pgEnum('post_interaction_type', [
	'LIKE',
	'REPOST'
]);

export const postInteraction = pgTable(
	'post_interaction',
	{
		userId: citext('user_id')
			.notNull()
			.references(() => user.id),
		postId: uuid('post_id')
			.notNull()
			.references(() => post.id),
		type: postInteractionType('post_interaction_type').notNull()
	},
	(t) => ({
		pk: primaryKey(t.userId, t.postId, t.type)
	})
);

export const postInteractionRelations = relations(
	postInteraction,
	({ one }) => ({
		user: one(user, {
			fields: [postInteraction.userId],
			references: [user.id],
			relationName: 'user__interactions'
		}),
		post: one(post, {
			fields: [postInteraction.postId],
			references: [post.id],
			relationName: 'post__interactions'
		})
	})
);

export type PostInteractionSchemaType = InferSelectModel<
	typeof postInteraction
>;
