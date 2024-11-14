import { InferSelectModel, relations, sql } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import {
	conversationParticipant,
	post,
	postCollection,
	postInteraction,
	userPlanet,
	userPlanetMember,
	userProfileField,
	userRelationship,
	userSetting,
	userVerification
} from '..';

export const userType = pgEnum('user_type', ['PUBLIC', 'PRIVATE']);

export const user = pgTable('user', {
	id: text('id')
		.default(sql`gen_random_uuid()`)
		.primaryKey(),
	email: text('email').unique(),
	username: text('username').notNull().unique(),
	displayName: text('display_name'),
	bio: text('bio'),
	extendedBio: text('extended_bio'),
	avatar: text('avatar'),
	banner: text('banner'),
	background: text('background'),
	suspended: boolean('suspended').default(false),
	type: userType('user_type').default('PUBLIC'),
	profession: text('profession'),
	location: text('location'),
	website: text('website'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const userRelations = relations(user, ({ one, many }) => ({
	toRelationships: many(userRelationship, {
		relationName: 'user_to_relationships'
	}),
	fromRelationships: many(userRelationship, {
		relationName: 'user_from_relationships'
	}),
	posts: many(post, {
		relationName: 'posts'
	}),
	postInteraction: many(postInteraction),
	verification: one(userVerification),
	profileFields: many(userProfileField),
	ownedPlanets: many(userPlanet),
	joinedPlanets: many(userPlanetMember),
	settings: many(userSetting),
	conversations: many(conversationParticipant),
	collections: many(postCollection)
}));

export type UserSchemaType = InferSelectModel<typeof user>;
