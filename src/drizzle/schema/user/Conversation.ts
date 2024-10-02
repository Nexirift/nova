import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, pgEnum, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '..';

export const conversationType = pgEnum('conversation_type', [
	'DIRECT',
	'GROUP'
]);

export const conversation = pgTable('conversation', {
	id: uuid('id').primaryKey(),
	type: conversationType('conversation_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const conversationRelations = relations(conversation, ({ many }) => ({
	messages: many(conversationMessage),
	participants: many(conversationParticipant, {
		relationName: 'conversation_participants'
	})
}));

export const conversationMessage = pgTable('conversation_message', {
	id: uuid('id').primaryKey(),
	conversationId: uuid('conversation_id').notNull(),
	senderId: text('sender_id').notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const conversationMessageRelations = relations(
	conversationMessage,
	({ one }) => ({
		conversation: one(conversation, {
			fields: [conversationMessage.conversationId],
			references: [conversation.id]
		}),
		sender: one(conversationParticipant, {
			fields: [conversationMessage.senderId],
			references: [conversationParticipant.userId]
		})
	})
);

export const conversationParticipant = pgTable('conversation_participant', {
	conversationId: uuid('conversation_id').notNull(),
	userId: text('user_id').notNull(),
	joinedAt: timestamp('joined_at').notNull().defaultNow()
});

export const conversationParticipantRelations = relations(
	conversationParticipant,
	({ one, many }) => ({
		messages: many(conversationMessage),
		conversation: one(conversation, {
			fields: [conversationParticipant.conversationId],
			references: [conversation.id],
			relationName: 'conversation_participants'
		}),
		user: one(user, {
			fields: [conversationParticipant.userId],
			references: [user.id]
		})
	})
);
