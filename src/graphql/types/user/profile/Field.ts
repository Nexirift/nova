import { db } from "@/db";
import type { UserProfileFieldSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { User } from "@/graphql/types";

export const UserProfileField =
  builder.objectRef<UserProfileFieldSchemaType>("UserProfileField");

UserProfileField.implement({
  fields: (t) => ({
    user: t.field({
      type: User,
      nullable: false,
      resolve: async (_user) => {
        const result = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, _user.userId),
        });
        return result!;
      },
    }),
    name: t.exposeString("name", { nullable: false }),
    value: t.exposeString("value", { nullable: false }),
    spotlighted: t.exposeBoolean("spotlighted", { nullable: false }),
  }),
});
