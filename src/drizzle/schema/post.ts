import { sql, relations, InferSelectModel } from 'drizzle-orm';
import {
	pgTable,
	uuid,
	AnyPgColumn,
	text,
	boolean,
	timestamp,
	primaryKey,
	pgEnum,
	json,
	integer
} from 'drizzle-orm/pg-core';
import { user, userPlanetPost } from './user';

export const postInteractionType = pgEnum('post_interaction_type', [
	'LIKE',
	'BOOKMARK',
	'REPOST'
]);

export const postGiveawayType = pgEnum('post_giveaway_type', [
	'GIVEAWAY',
	'RAFFLE'
]);

export const post = pgTable('post', {
	id: uuid('id').defaultRandom().primaryKey(),
	authorId: text('author_id')
		.notNull()
		.references(() => user.id),
	parentId: uuid('parent_id').references((): AnyPgColumn => post.id),
	content: text('content').notNull(),
	published: boolean('published').notNull().default(false),
	deleted: boolean('deleted').notNull().default(false),
	pinned: boolean('pinned').notNull().default(false),
	hidden: boolean('hidden').notNull().default(false),
	quoted: boolean('quote').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const postRelations = relations(post, ({ one, many }) => ({
	author: one(user, {
		fields: [post.authorId],
		references: [user.id],
		relationName: 'posts'
	}),
	parent: one(post, {
		fields: [post.parentId],
		references: [post.id],
		relationName: 'replies'
	}),
	replies: many(post, {
		relationName: 'replies'
	}),
	interactions: many(postInteraction),
	editHistory: many(postEditHistory),
	poll: one(postPoll),
	giveaway: one(postGiveaway),
	planet: one(userPlanetPost),
	media: many(postMedia)
}));

export const postMedia = pgTable('post_media', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id').references(() => post.id),
	url: text('url').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postMediaRelations = relations(postMedia, ({ one }) => ({
	post: one(post, {
		fields: [postMedia.postId],
		references: [post.id],
		relationName: 'post_media'
	})
}));

export const postInteraction = pgTable(
	'post_interaction',
	{
		userId: text('user_id')
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

export const postEditHistory = pgTable('post_edit_history', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id')
		.notNull()
		.references(() => post.id),
	content: text('content').notNull(),
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

export const postPoll = pgTable('post_poll', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id')
		.notNull()
		.references(() => post.id),
	options: json('options').notNull(),
	finish: timestamp('finish').notNull().defaultNow(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postPollRelations = relations(postPoll, ({ many, one }) => ({
	post: one(post, {
		fields: [postPoll.postId],
		references: [post.id],
		relationName: 'post_poll'
	}),
	votes: many(postPollVote)
}));

export const postPollVote = pgTable('post_poll_vote', {
	id: uuid('id').defaultRandom().primaryKey(),
	postId: uuid('post_id')
		.notNull()
		.references(() => post.id),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	option: text('option').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const postPollVoteRelations = relations(postPollVote, ({ one }) => ({
	poll: one(postPoll, {
		fields: [postPollVote.postId],
		references: [postPoll.id]
	}),
	user: one(user, {
		fields: [postPollVote.userId],
		references: [user.id]
	})
}));

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
	userId: text('user_id')
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

export type Post = InferSelectModel<typeof post>;
export type PostMedia = InferSelectModel<typeof postMedia>;
export type PostInteraction = InferSelectModel<typeof postInteraction>;
export type PostEditHistory = InferSelectModel<typeof postEditHistory>;
export type PostPoll = InferSelectModel<typeof postPoll>;
export type PostPollVote = InferSelectModel<typeof postPollVote>;
export type PostGiveaway = InferSelectModel<typeof postGiveaway>;
export type PostGiveawayMeta = InferSelectModel<typeof postGiveawayMeta>;
export type PostGiveawayEntry = InferSelectModel<typeof postGiveawayEntry>;
