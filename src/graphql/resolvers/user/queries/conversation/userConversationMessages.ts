import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { getParticipant } from "@/graphql/helpers/user/Conversation";
import { UserConversationMessage } from "@/graphql/types";

builder.queryField("userConversationMessages", (t) =>
  t.field({
    type: [UserConversationMessage],
    args: {
      id: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
      offset: t.arg.int({ required: false, defaultValue: 0 }),
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
          desc(userConversationMessage.createdAt),
      });
    },
  }),
);
