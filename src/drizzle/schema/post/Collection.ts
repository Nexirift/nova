import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { post, user } from '..';
import { relations } from 'drizzle-orm';

export const postCollection = pgTable(
	'post_collection',
	{
		id: uuid('id').notNull().defaultRandom(),
		name: text('name').notNull(),
		description: text('description').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id)
	},
	(t) => ({
		pk: primaryKey(t.id, t.name, t.userId)
	})
);

export const postCollectionRelations = relations(postCollection, ({ one }) => ({
	user: one(user, {
		fields: [postCollection.userId],
		references: [user.id],
		relationName: 'user__collections'
	})
}));

export const postCollectionItem = pgTable(
	'post_collection_item',
	{
		collectionId: text('collection_id')
			.notNull()
			.references(() => postCollection.id),
		postId: uuid('post_id')
			.notNull()
			.references(() => post.id)
	},
	(t) => ({
		pk: primaryKey(t.collectionId, t.postId)
	})
);

export const postCollectionItemRelations = relations(
	postCollectionItem,
	({ one }) => ({
		collection: one(postCollection, {
			fields: [postCollectionItem.collectionId],
			references: [postCollection.id],
			relationName: 'collection__items'
		}),
		post: one(post, {
			fields: [postCollectionItem.postId],
			references: [post.id],
			relationName: 'post__collections'
		})
	})
);
