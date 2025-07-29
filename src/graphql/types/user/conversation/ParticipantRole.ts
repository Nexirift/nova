import { db } from "@/db";
import type { UserConversationParticipantRoleSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import {
  UserConversationParticipant,
  UserConversationRole,
} from "@/graphql/types";

export const UserConversationParticipantRole =
  builder.objectRef<UserConversationParticipantRoleSchemaType>(
    "UserConversationParticipantRole",
  );

UserConversationParticipantRole.implement({
  fields: (t) => ({
    participant: t.field({
      type: UserConversationParticipant,
      nullable: false,
      resolve: (userConversationParticipant) =>
        db.query.userConversationParticipant
          .findFirst({
            where: (participant, { eq }) =>
              eq(participant.userId, userConversationParticipant.participantId),
          })
          .then((result) => result!),
    }),
    role: t.field({
      type: UserConversationRole,
      nullable: true,
      resolve: (userConversationRole) =>
        db.query.userConversationRole
          .findFirst({
            where: (role, { eq }) => eq(role.id, userConversationRole.roleId),
          })
          .then((result) => result!),
    }),
  }),
});
