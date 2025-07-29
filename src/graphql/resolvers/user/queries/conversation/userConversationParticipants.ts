import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { getParticipant } from "@/graphql/helpers/user/Conversation";
import { UserConversationParticipant } from "@/graphql/types";

builder.queryField("userConversationParticipants", (t) =>
  t.field({
    type: [UserConversationParticipant],
    args: {
      id: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
      offset: t.arg.int({ required: false, defaultValue: 0 }),
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
          desc(userConversationMessage.joinedAt),
      });
    },
  }),
);
