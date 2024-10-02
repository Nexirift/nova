import { InferSelectModel, relations } from 'drizzle-orm';
import {
	pgTable,
	uuid,
	text,
	timestamp,
	boolean,
	AnyPgColumn
} from 'drizzle-orm/pg-core';
import {
	user,
	userPlanetPost,
	postGiveaway,
	postPoll,
	postInteraction,
	postMedia,
	postEditHistory
} from '..';

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

export type PostSchemaType = InferSelectModel<typeof post>;