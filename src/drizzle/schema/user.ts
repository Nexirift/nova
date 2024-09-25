import { sql, relations, InferSelectModel } from 'drizzle-orm';
import {
	pgEnum,
	pgTable,
	text,
	boolean,
	timestamp,
	primaryKey,
	uuid
} from 'drizzle-orm/pg-core';
import { post, postInteraction } from '../schema';
import { conversationParticipant } from './conversation';

export const userType = pgEnum('user_type', ['PUBLIC', 'PRIVATE', 'ARTIST']);
export const userVerificationType = pgEnum('user_verification_type', [
	'NOTABLE',
	'BUSINESS',
	'OFFICIAL',
	'TESTER'
]);
export const userRelationshipType = pgEnum('user_relationship_type', [
	'FOLLOW',
	'REQUEST',
	'BLOCK',
	'MUTE'
]);

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
	conversations: many(conversationParticipant)
}));

export const userRelationship = pgTable(
	'user_relationship',
	{
		toId: text('to_id')
			.notNull()
			.references(() => user.id),
		fromId: text('from_id')
			.notNull()
			.references(() => user.id),
		type: userRelationshipType('user_relationship_type').notNull(),
		reason: text('reason'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at')
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => ({
		pk: primaryKey(t.toId, t.fromId)
	})
);

export const userRelationshipRelations = relations(
	userRelationship,
	({ one }) => ({
		to: one(user, {
			fields: [userRelationship.toId],
			references: [user.id],
			relationName: 'user_to_relationships'
		}),
		from: one(user, {
			fields: [userRelationship.fromId],
			references: [user.id],
			relationName: 'user_from_relationships'
		})
	})
);

export const userVerification = pgTable('user_verification', {
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	type: userVerificationType('user_verification_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const userVerificationRelations = relations(
	userVerification,
	({ one }) => ({
		user: one(user, {
			fields: [userVerification.userId],
			references: [user.id],
			relationName: 'user_verification'
		})
	})
);

export const userProfileField = pgTable('user_profile_field', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	name: text('name').notNull(),
	value: text('value').notNull(),
	spotlighted: boolean('spotlighted').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userProfileFieldRelations = relations(
	userProfileField,
	({ one }) => ({
		user: one(user, {
			fields: [userProfileField.userId],
			references: [user.id],
			relationName: 'user_profile_field'
		})
	})
);

export const userSetting = pgTable('user_setting', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	key: text('key').notNull(),
	value: text('value').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userSettingRelations = relations(userSetting, ({ one }) => ({
	user: one(user, {
		fields: [userSetting.userId],
		references: [user.id],
		relationName: 'user_setting'
	})
}));

export const userPlanet = pgTable('user_planet', {
	id: uuid('id').defaultRandom().primaryKey(),
	creatorId: text('creator_id')
		.notNull()
		.references(() => user.id),
	name: text('name').notNull(),
	description: text('description'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userPlanetRelations = relations(userPlanet, ({ one, many }) => ({
	creator: one(user, {
		fields: [userPlanet.creatorId],
		references: [user.id]
	}),
	members: many(userPlanetMember),
	posts: many(userPlanetPost)
}));

export const userPlanetMember = pgTable('user_planet_member', {
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	planetId: uuid('planet_id')
		.notNull()
		.references(() => userPlanet.id),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userPlanetMemberRelations = relations(
	userPlanetMember,
	({ one }) => ({
		user: one(user, {
			fields: [userPlanetMember.userId],
			references: [user.id]
		}),
		planet: one(userPlanet, {
			fields: [userPlanetMember.planetId],
			references: [userPlanet.id]
		})
	})
);

export const userPlanetPost = pgTable('user_planet_post', {
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	planetId: uuid('planet_id')
		.notNull()
		.references(() => userPlanet.id),
	postId: uuid('post_id')
		.notNull()
		.references(() => post.id),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userPlanetPostRelations = relations(userPlanetPost, ({ one }) => ({
	user: one(user, {
		fields: [userPlanetPost.userId],
		references: [user.id]
	}),
	planet: one(userPlanet, {
		fields: [userPlanetPost.planetId],
		references: [userPlanet.id]
	}),
	post: one(post, {
		fields: [userPlanetPost.postId],
		references: [post.id]
	})
}));

export const userBadge = pgTable('user_badges', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	media: text('media'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userBadgeRelations = relations(userBadge, ({ many }) => ({
	users: many(userBadges)
}));

export const userBadges = pgTable('user_badges', {
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	badgeId: uuid('badge_id')
		.notNull()
		.references(() => userBadge.id),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
	user: one(user, {
		fields: [userBadges.userId],
		references: [user.id]
	}),
	badge: one(userBadge, {
		fields: [userBadges.badgeId],
		references: [userBadge.id]
	})
}));

export type User = InferSelectModel<typeof user>;
export type UserRelationship = InferSelectModel<typeof userRelationship>;
export type UserVerification = InferSelectModel<typeof userVerification>;
export type UserProfileField = InferSelectModel<typeof userProfileField>;
export type UserPlanet = InferSelectModel<typeof userPlanet>;
export type UserSetting = InferSelectModel<typeof userSetting>;
