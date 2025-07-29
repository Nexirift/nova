import { Context } from "@/context";
import builder from "@/graphql/builder";
import {
  getConversation,
  getParticipant,
} from "@/graphql/helpers/user/Conversation";
import { UserConversation } from "@/graphql/types";

builder.queryField("userConversation", (t) =>
  t.field({
    type: UserConversation,
    args: {
      id: t.arg.string({ required: true }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, args, ctx: Context) => {
      const conversation = await getConversation(args.id);
      await getParticipant(ctx.auth?.user?.id, args.id);
      return conversation;
    },
  }),
);
