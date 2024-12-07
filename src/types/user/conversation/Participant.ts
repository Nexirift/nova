import { User, UserConversation } from '../..';
import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type UserConversationParticipantSchemaType } from '../../../drizzle/schema';

export const UserConversationParticipant =
	builder.objectRef<UserConversationParticipantSchemaType>(
		'UserConversationParticipant'
	);

UserConversationParticipant.implement({
	fields: (t) => ({
		user: t.field({
			type: User,
			nullable: false,
			resolve: async (userConversationParticipant) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) =>
						eq(user.id, userConversationParticipant.userId)
				});
				return result!;
			}
		}),
		conversation: t.field({
			type: UserConversation,
			nullable: false,
			resolve: async (userConversationParticipant) => {
				const result = await db.query.userConversation.findFirst({
					where: (userConversation, { eq }) =>
						eq(
							userConversation.id,
							userConversationParticipant.conversationId
						)
				});
				return result!;
			}
		}),
		joinedAt: t.expose('joinedAt', { type: 'Date', nullable: false })
	})
});
