import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, post } from '..';

export const postEditHistory = pgTable('post_edit_history', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id')
		.notNull()
		.references(() => post.id, { onDelete: 'cascade' }),
	content: citext('content').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postEditHistoryRelations = relations(
	postEditHistory,
	({ one }) => ({
		post: one(post, {
			fields: [postEditHistory.postId],
			references: [post.id],
			relationName: 'post_edit_history'
		})
	})
);

export type PostEditHistorySchemaType = InferSelectModel<
	typeof postEditHistory
>;
