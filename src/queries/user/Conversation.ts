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
		smartSubscription: true,
		subscribe: (subscriptions, root, args) =>
			subscriptions.register(`userConversationMessages${args.id}`),
		resolve: async (_root, args, ctx: Context) => {
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
