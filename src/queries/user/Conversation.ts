import { db } from '@nexirift/db';
import { builder } from '../../builder';
import type { Context } from '../../context';
import {
	getConversation,
	getParticipant
} from '../../helpers/user/Conversation';
import { UserConversation, UserConversationParticipant } from '../../types';
import { UserConversationMessage } from '../../types/user/conversation/Message';

builder.queryField('getUserConversation', (t) =>
	t.field({
		type: UserConversation,
		args: {
			id: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await getConversation(args.id);
			await getParticipant(ctx.auth?.user?.id, args.id);
			return conversation;
		}
	})
);

builder.queryField('getUserConversationMessages', (t) =>
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
			await getParticipant(ctx.auth?.user?.id, args.id);

			return db.query.userConversationMessage.findMany({
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

builder.queryField('getUserConversationParticipants', (t) =>
	t.field({
		type: [UserConversationParticipant],
		args: {
			id: t.arg.string({ required: true }),
			limit: t.arg.int({ required: false, defaultValue: 10 }),
			offset: t.arg.int({ required: false, defaultValue: 0 })
		},
		authScopes: { loggedIn: true },
		smartSubscription: true,
		subscribe: (subscriptions, _root, args) =>
			subscriptions.register(`userConversationParticipants|${args.id}`),
		resolve: async (_root, args, ctx: Context) => {
			await getParticipant(ctx.auth?.user?.id, args.id);

			return db.query.userConversationParticipant.findMany({
				where: (userConversationMessage, { eq }) =>
					eq(userConversationMessage.conversationId, args.id),
				limit: args.limit ?? undefined,
				offset: args.offset ?? undefined,
				orderBy: (userConversationMessage, { desc }) =>
					desc(userConversationMessage.joinedAt)
			});
		}
	})
);
