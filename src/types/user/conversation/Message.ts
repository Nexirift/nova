import { User, UserConversation } from '../..';
import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type UserConversationMessageSchemaType } from '../../../drizzle/schema';
import { UserConversationParticipant } from './Participant';

export const UserConversationMessage =
	builder.objectRef<UserConversationMessageSchemaType>(
		'UserConversationMessage'
	);

UserConversationMessage.implement({
	fields: (t) => ({
		conversation: t.field({
			type: UserConversation,
			nullable: false,
			resolve: async (userConversationMessage) => {
				const result = await db.query.userConversation.findFirst({
					where: (userConversation, { eq }) =>
						eq(
							userConversation.id,
							userConversationMessage.conversationId
						)
				});
				return result!;
			}
		}),
		sender: t.field({
			type: UserConversationParticipant,
			nullable: false,
			resolve: async (userConversationMessage) => {
				const result =
					await db.query.userConversationParticipant.findFirst({
						where: (userConversationParticipant, { eq }) =>
							eq(
								userConversationParticipant.userId,
								userConversationMessage.senderId
							)
					});
				return result!;
			}
		}),
		content: t.exposeString('content', { nullable: false }),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
