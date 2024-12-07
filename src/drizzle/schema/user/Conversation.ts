import { InferSelectModel, relations } from 'drizzle-orm';
import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, user } from '..';

export const userConversationType = pgEnum('user_conversation_type', [
	'DIRECT',
	'GROUP'
]);

export const userConversation = pgTable('user_conversation', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: citext('name'),
	type: userConversationType('conversation_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userConversationRelations = relations(
	userConversation,
	({ many }) => ({
		messages: many(userConversationMessage),
		participants: many(userConversationParticipant, {
			relationName: 'user_conversation_participants'
		})
	})
);

export const userConversationMessage = pgTable('user_conversation_message', {
	id: uuid('id').defaultRandom().primaryKey(),
	conversationId: uuid('conversation_id').notNull(),
	senderId: citext('sender_id').notNull(),
	content: citext('content').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

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
		conversationId: uuid('conversation_id').notNull(),
		userId: citext('user_id').notNull(),
		joinedAt: timestamp('joined_at').notNull().defaultNow()
	}
);

export const userConversationParticipantRelations = relations(
	userConversationParticipant,
	({ one, many }) => ({
		messages: many(userConversationMessage),
		conversation: one(userConversation, {
			fields: [userConversationParticipant.conversationId],
			references: [userConversation.id],
			relationName: 'user_conversation_participants'
		}),
		user: one(user, {
			fields: [userConversationParticipant.userId],
			references: [user.id]
		})
	})
);

export type UserConversationSchemaType = InferSelectModel<
	typeof userConversation
>;
export type UserConversationMessageSchemaType = InferSelectModel<
	typeof userConversationMessage
>;
export type UserConversationParticipantSchemaType = InferSelectModel<
	typeof userConversationParticipant
>;
