import { relations } from 'drizzle-orm';
import {
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from '.';

export const userBadge = pgTable('user_badge', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	media: text('media'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userBadgeRelations = relations(userBadge, ({ many }) => ({
	users: many(userBadges)
}));

export const userBadges = pgTable(
	'user_badges',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		badgeId: uuid('badge_id')
			.notNull()
			.references(() => userBadge.id),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => ({
		pk: primaryKey(t.userId, t.badgeId)
	})
);

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
