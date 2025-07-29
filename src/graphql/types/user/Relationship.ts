import { db } from "@/db";
import type { UserRelationshipSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { User } from "@/graphql/types";

export const UserRelationshipType = builder.enumType("UserRelationshipType", {
  values: ["FOLLOW", "REQUEST", "BLOCK", "MUTE"],
});

export const UserRelationshipDirection = builder.enumType(
  "UserRelationshipDirection",
  {
    values: ["INCOMING", "OUTGOING"],
  },
);

export const UserRelationship =
  builder.objectRef<UserRelationshipSchemaType>("UserRelationship");

UserRelationship.implement({
  fields: (t) => ({
    to: t.field({
      type: User,
      nullable: false,
      resolve: async (_user) => {
        const result = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, _user.toId),
        });
        return result!;
      },
    }),
    from: t.field({
      type: User,
      nullable: false,
      resolve: async (_user) => {
        const result = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, _user.fromId),
        });
        return result!;
      },
    }),
    type: t.expose("type", {
      type: UserRelationshipType,
      nullable: false,
    }),
    reason: t.exposeString("reason", {
      nullable: true,
    }),
    since: t.expose("createdAt", { type: "Date", nullable: false }),
  }),
});
