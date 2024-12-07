import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { User } from '../../types';
import { Context } from '../../context';
import { UserConversationMessage } from '../../types/user/conversation/Message';

builder.queryField('userConversationMessages', (t) =>
	t.field({
		type: [UserConversationMessage],
		args: {
			id: t.arg.string({ required: true }),
			limit: t.arg.int({ required: false }),
			offset: t.arg.int({ required: false })
		},
		authScopes: {
			loggedIn: true
		},
		smartSubscription: true,
		subscribe: (subscriptions, root, args) =>
			subscriptions.register(`userConversationMessages${args.id}`),
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await db.query.userConversation.findFirst({
				where: (userConversation, { eq }) =>
					eq(userConversation.id, args.id)
			});

			if (!conversation) {
				throw new GraphQLError('The conversation does not exist.', {
					extensions: {
						code: 'CONVERSATION_NOT_FOUND'
					}
				});
			}

			const participant =
				await db.query.userConversationParticipant.findFirst({
					where: (userConversationParticipant, { eq }) =>
						eq(userConversationParticipant.userId, ctx.oidc?.sub)
				});

			if (!participant) {
				throw new GraphQLError(
					'You must be a participant in this conversation to send a message.',
					{
						extensions: {
							code: 'CONVERSATION_PARTICIPANT_REQUIRED'
						}
					}
				);
			}

			const messages = await db.query.userConversationMessage.findMany({
				where: (userConversationMessage, { eq }) =>
					eq(userConversationMessage.conversationId, args.id),
				limit: args.limit!,
				offset: args.offset!,
				orderBy: (userConversationMessage, { desc }) =>
					desc(userConversationMessage.createdAt)
			});

			return messages;
		}
	})
);
