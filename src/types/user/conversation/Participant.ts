import type { UserConversationParticipantSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { User, UserConversation } from '../..';
import { builder } from '../../../builder';
import { UserConversationParticipantRole } from './ParticipantRole';

export const UserConversationParticipant =
	builder.objectRef<UserConversationParticipantSchemaType>(
		'UserConversationParticipant'
	);

UserConversationParticipant.implement({
	fields: (t) => ({
		id: t.expose('id', { type: 'String', nullable: false }),
		user: t.field({
			type: User,
			nullable: false,
			resolve: async ({ userId }) =>
				await db.query.user
					.findFirst({
						where: (user, { eq }) => eq(user.id, userId)
					})
					.then((result) => result!)
		}),
		conversation: t.field({
			type: UserConversation,
			nullable: false,
			resolve: async ({ conversationId }) =>
				await db.query.userConversation
					.findFirst({
						where: (userConversation, { eq }) =>
							eq(userConversation.id, conversationId)
					})
					.then((result) => result!)
		}),
		roles: t.field({
			type: [UserConversationParticipantRole],
			nullable: false,
			resolve: async ({ id }) =>
				await db.query.userConversationParticipantRole.findMany({
					where: (role, { eq }) => eq(role.participantId, id)
				})
		}),
		joinedAt: t.expose('joinedAt', { type: 'Date', nullable: false })
	})
});
