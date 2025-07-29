import { db } from "@/db";
import type { UserConversationMessageSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { UserConversation, UserConversationParticipant } from "@/graphql/types";

export const UserConversationMessage =
  builder.objectRef<UserConversationMessageSchemaType>(
    "UserConversationMessage",
  );

UserConversationMessage.implement({
  fields: (t) => ({
    conversation: t.field({
      type: UserConversation,
      nullable: false,
      resolve: (userConversationMessage) =>
        db.query.userConversation
          .findFirst({
            where: (userConversation, { eq }) =>
              eq(userConversation.id, userConversationMessage.conversationId),
          })
          .then((result) => result!),
    }),
    sender: t.field({
      type: UserConversationParticipant,
      nullable: false,
      resolve: (userConversationMessage) =>
        db.query.userConversationParticipant
          .findFirst({
            where: (userConversationParticipant, { eq }) =>
              eq(
                userConversationParticipant.userId,
                userConversationMessage.senderId,
              ),
          })
          .then((result) => result!),
    }),
    content: t.exposeString("content", { nullable: false }),
    createdAt: t.expose("createdAt", { type: "Date", nullable: false }),
  }),
});
