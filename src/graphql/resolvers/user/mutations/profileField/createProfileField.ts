import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { createProfile } from "@/graphql/helpers/user/Profile";
import { UserProfileField } from "@/graphql/types";
import { userProfileField } from "@nexirift/db/schema";

builder.mutationField("createProfileField", (t) =>
  t.field({
    type: UserProfileField,
    args: {
      name: t.arg.string({ required: true }),
      value: t.arg.string({ required: true }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, _args, ctx: Context) => {
      await createProfile(ctx.auth.user.id);

      const existingField = await db.query.userProfileField.findFirst({
        where: (profileField, { eq, and }) =>
          and(
            eq(profileField.userId, ctx.auth?.user?.id),
            eq(profileField.name, _args.name),
          ),
      });

      if (existingField) {
        return throwError(
          "Profile field with the same name already exists",
          "PROFILE_FIELD_ALREADY_EXISTS",
        );
      }

      return db
        .insert(userProfileField)
        .values({
          name: _args.name,
          value: _args.value,
          userId: ctx.auth?.user?.id,
        })
        .returning()
        .then((res) => res[0]);
    },
  }),
);
