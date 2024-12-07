import { InferSelectModel, relations } from 'drizzle-orm';
import { json, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, post, user } from '..';

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
	userId: citext('user_id')
		.notNull()
		.references(() => user.id),
	option: citext('option').notNull(),
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

export type PostPollSchemaType = InferSelectModel<typeof postPoll>;
export type PostPollVoteSchemaType = InferSelectModel<typeof postPollVote>;
