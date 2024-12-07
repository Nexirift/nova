import { InferSelectModel, relations } from 'drizzle-orm';
import {
	boolean,
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { citext, post, user } from '..';

export const postGiveawayType = pgEnum('post_giveaway_type', [
	'GIVEAWAY',
	'RAFFLE'
]);

export const postGiveaway = pgTable('post_giveaway', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id')
		.notNull()
		.references(() => post.id),
	type: postGiveawayType('post_giveaway_type').notNull(),
	finish: timestamp('finish').notNull().defaultNow(),
	requirements: json('requirements').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postGiveawayRelations = relations(postGiveaway, ({ one }) => ({
	post: one(post, {
		fields: [postGiveaway.postId],
		references: [post.id],
		relationName: 'post_giveaway'
	}),
	metadata: one(postGiveawayMeta, {
		fields: [postGiveaway.id],
		references: [postGiveawayMeta.giveawayId],
		relationName: 'post_giveaway_metadata'
	})
}));

export const postGiveawayMeta = pgTable(
	'post_giveaway_metadata',
	{
		giveawayId: uuid('giveaway_id')
			.notNull()
			.references(() => postGiveaway.id),
		replyLengthMin: integer('reply_length_min').notNull(),
		mustIncludeMedia: boolean('must_include_media').notNull()
	},
	(t) => ({
		pk: primaryKey(t.giveawayId)
	})
);

export const postGiveawayMetaRelations = relations(
	postGiveawayMeta,
	({ one }) => ({
		giveaway: one(postGiveaway, {
			fields: [postGiveawayMeta.giveawayId],
			references: [postGiveaway.id],
			relationName: 'post_giveaway_metadata'
		})
	})
);

export const postGiveawayEntry = pgTable('post_giveaway_entry', {
	id: uuid('id').defaultRandom().primaryKey(),
	giveawayId: uuid('giveaway_id')
		.notNull()
		.references(() => postGiveaway.id),
	userId: citext('user_id')
		.notNull()
		.references(() => user.id),
	requirements: json('requirements').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postGiveawayEntryRelations = relations(
	postGiveawayEntry,
	({ one }) => ({
		giveaway: one(postGiveaway, {
			fields: [postGiveawayEntry.giveawayId],
			references: [postGiveaway.id],
			relationName: 'post_giveaway_entry'
		}),
		user: one(user, {
			fields: [postGiveawayEntry.userId],
			references: [user.id],
			relationName: 'post_giveaway_entry'
		})
	})
);

export type PostGiveawaySchemaType = InferSelectModel<typeof postGiveaway>;
export type PostGiveawayMetaSchemaType = InferSelectModel<
	typeof postGiveawayMeta
>;
export type PostGiveawayEntrySchemaType = InferSelectModel<
	typeof postGiveawayEntry
>;
