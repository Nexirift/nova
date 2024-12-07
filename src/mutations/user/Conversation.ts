import { Context } from '../../context';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { userConversationMessage } from '../../drizzle/schema';
import { UserConversationMessage } from '../../types/user/conversation/Message';
import { pubsub } from '../../pubsub';

builder.mutationField('createConversationMessage', (t) =>
	t.field({
		type: UserConversationMessage,
		args: {
			content: t.arg.string({ required: true }),
			conversationId: t.arg.string({ required: true })
		},
		resolve: async (_root, _args, ctx: Context) => {
			pubsub.publish(
				`userConversationMessages${_args.conversationId}`,
				{}
			);
			return db
				.insert(userConversationMessage)
				.values({
					content: _args.content,
					conversationId: _args.conversationId,
					senderId: '1' // ctx.oidc.sub
				})
				.returning()
				.then((res) => res[0]);
		}
	})
);
