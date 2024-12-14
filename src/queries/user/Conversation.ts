import { GraphQLError } from 'graphql';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { Context } from '../../context';
import { UserConversationMessage } from '../../types/user/conversation/Message';
import { UserConversation } from '../../types';
import {
	getConversation,
	getParticipant
} from '../../helpers/user/Conversation';

builder.queryField('getUserConversation', (t) =>
	t.field({
		type: UserConversation,
		args: {
			id: t.arg.string({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await getConversation(args.id);
			await getParticipant(ctx.oidc?.sub, args.id);
			return conversation;
		}
	})
);

builder.queryField('userConversationMessages', (t) =>
	t.field({
		type: [UserConversationMessage],
		args: {
			id: t.arg.string({ required: true }),
			limit: t.arg.int({ required: false, defaultValue: 10 }),
			offset: t.arg.int({ required: false, defaultValue: 0 })
		},
		authScopes: { loggedIn: true },
		smartSubscription: true,
		subscribe: (subscriptions, _root, args) =>
			subscriptions.register(`userConversationMessages|${args.id}`),
		resolve: async (_root, args, ctx: Context) => {
			await getParticipant(ctx.oidc?.sub, args.id);

			return await db.query.userConversationMessage.findMany({
				where: (userConversationMessage, { eq }) =>
					eq(userConversationMessage.conversationId, args.id),
				limit: args.limit ?? undefined,
				offset: args.offset ?? undefined,
				orderBy: (userConversationMessage, { desc }) =>
					desc(userConversationMessage.createdAt)
			});
		}
	})
);
