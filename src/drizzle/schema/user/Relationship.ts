import { InferSelectModel, relations } from 'drizzle-orm';
import { pgEnum, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { citext, user } from '..';

export const userRelationshipType = pgEnum('user_relationship_type', [
	'FOLLOW',
	'REQUEST',
	'BLOCK',
	'MUTE'
]);

export const userRelationship = pgTable(
	'user_relationship',
	{
		toId: citext('to_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		fromId: citext('from_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: userRelationshipType('user_relationship_type').notNull(),
		reason: citext('reason'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at')
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => ({
		pk: primaryKey(t.toId, t.fromId, t.type)
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

export type UserRelationshipSchemaType = InferSelectModel<
	typeof userRelationship
>;
