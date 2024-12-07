import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, post } from '..';

export const postMedia = pgTable('post_media', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id').references(() => post.id),
	url: citext('url').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postMediaRelations = relations(postMedia, ({ one }) => ({
	post: one(post, {
		fields: [postMedia.postId],
		references: [post.id],
		relationName: 'post_media'
	})
}));

export type PostMediaSchemaType = InferSelectModel<typeof postMedia>;
