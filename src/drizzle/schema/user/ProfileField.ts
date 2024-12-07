import { InferSelectModel, relations } from 'drizzle-orm';
import { boolean, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, user } from '..';

export const userProfileField = pgTable('user_profile_field', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: citext('user_id')
		.notNull()
		.references(() => user.id),
	name: citext('name').notNull(),
	value: citext('value').notNull(),
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

export type UserProfileFieldSchemaType = InferSelectModel<
	typeof userProfileField
>;
