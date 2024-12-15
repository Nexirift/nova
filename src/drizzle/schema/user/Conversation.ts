import { InferSelectModel, relations, sql } from 'drizzle-orm';
import {
	boolean,
	pgEnum,
	pgTable,
	primaryKey,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { citext, user } from '..';

export const userConversationType = pgEnum('user_conversation_type', [
	'DIRECT',
	'GROUP'
]);

export const userConversation = pgTable('user_conversation', {
	id: uuid('id').defaultRandom().notNull().primaryKey(),
	name: citext('name'),
	type: userConversationType('conversation_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userConversationRelations = relations(
	userConversation,
	({ many }) => ({
		messages: many(userConversationMessage),
		participants: many(userConversationParticipant),
		roles: many(userConversationRole)
	})
);

export const userConversationMessage = pgTable(
	'user_conversation_message',
	{
		id: uuid('id').defaultRandom().notNull(),
		conversationId: uuid('conversation_id').notNull(),
		senderId: citext('sender_id').notNull(),
		content: citext('content').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(t) => {
		return {
			pk: primaryKey({
				columns: [
					t.id,
					t.conversationId,
					t.senderId,
					t.createdAt,
					t.content
				]
			})
		};
	}
);

export const userConversationMessageRelations = relations(
	userConversationMessage,
	({ one }) => ({
		conversation: one(userConversation, {
			fields: [userConversationMessage.conversationId],
			references: [userConversation.id]
		}),
		sender: one(userConversationParticipant, {
			fields: [userConversationMessage.senderId],
			references: [userConversationParticipant.userId]
		})
	})
);

export const userConversationParticipant = pgTable(
	'user_conversation_participant',
	{
		id: uuid('id').defaultRandom().notNull(),
		conversationId: uuid('conversation_id').notNull(),
		userId: citext('user_id').notNull(),
		joinedAt: timestamp('joined_at').notNull().defaultNow()
	},
	(t) => {
		return {
			pk: primaryKey({
				columns: [t.conversationId, t.userId]
			})
		};
	}
);

export const userConversationParticipantRelations = relations(
	userConversationParticipant,
	({ one, many }) => ({
		messages: many(userConversationMessage),
		conversation: one(userConversation, {
			fields: [userConversationParticipant.conversationId],
			references: [userConversation.id]
		}),
		user: one(user, {
			fields: [userConversationParticipant.userId],
			references: [user.id]
		}),
		roles: many(userConversationParticipantRole)
	})
);

export const userConversationRole = pgTable(
	'user_conversation_role',
	{
		id: uuid('id').defaultRandom().notNull(),
		name: citext('name').notNull(),
		description: citext('description'),
		conversationId: uuid('conversation_id').notNull(),
		default: boolean('default').notNull().default(false),
		permissions: citext('permissions')
			.notNull()
			.default(sql`'{}'::citext[]`)
	},
	(t) => {
		return {
			pk: primaryKey({
				columns: [t.id, t.conversationId]
			})
		};
	}
);

export const userConversationRoleRelations = relations(
	userConversationRole,
	({ one, many }) => ({
		conversation: one(userConversation, {
			fields: [userConversationRole.conversationId],
			references: [userConversation.id]
		}),
		members: many(userConversationParticipantRole)
	})
);

export const userConversationParticipantRole = pgTable(
	'user_conversation_participant_role',
	{
		participantId: uuid('participant_id').notNull(),
		roleId: uuid('role_id').notNull()
	},
	(t) => {
		return {
			pk: primaryKey({
				columns: [t.participantId, t.roleId]
			})
		};
	}
);

export const userConversationParticipantRoleRelations = relations(
	userConversationParticipantRole,
	({ one }) => ({
		participant: one(userConversationParticipant, {
			fields: [userConversationParticipantRole.participantId],
			references: [userConversationParticipant.id]
		}),
		role: one(userConversationRole, {
			fields: [userConversationParticipantRole.roleId],
			references: [userConversationRole.id]
		})
	})
);

export type UserConversationSchemaType = InferSelectModel<
	typeof userConversation
>;
export type UserConversationMessageSchemaType = InferSelectModel<
	typeof userConversationMessage
>;
export type UserConversationRoleSchemaType = InferSelectModel<
	typeof userConversationRole
>;
export type UserConversationParticipantSchemaType = InferSelectModel<
	typeof userConversationParticipant
>;
export type UserConversationParticipantRoleSchemaType = InferSelectModel<
	typeof userConversationParticipantRole
>;
