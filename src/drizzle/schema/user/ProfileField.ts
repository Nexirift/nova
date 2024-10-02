import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { user } from '.';

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

export type UserProfileField = InferSelectModel<typeof userProfileField>;
