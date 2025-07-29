import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { createProfile } from "@/graphql/helpers/user/Profile";
import { UserProfileField } from "@/graphql/types";
import { userProfileField } from "@nexirift/db/schema";
import { and, eq } from "drizzle-orm";

builder.mutationField("updateProfileField", (t) =>
  t.field({
    type: UserProfileField,
    args: {
      name: t.arg.string({ required: true }),
      newName: t.arg.string({ required: false }),
      newValue: t.arg.string({ required: false }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, _args, ctx: Context) => {
      // TODO: THERE IS LIKELY A BETTER WAY TO DO THIS!! MAYBE ON FIRST REQUEST?
      await createProfile(ctx.auth.user.id);

      const existingFields = await db.query.userProfileField.findMany({
        where: (profileField, { eq }) =>
          eq(profileField.userId, ctx.auth?.user?.id),
      });

      const existingField = existingFields.find(
        (field) => field.name === _args.name,
      );

      if (!existingField) {
        return throwError(
          "There is no profile field with the given name",
          "PROFILE_FIELD_NOT_FOUND",
        );
      }

      if (existingFields.find((field) => field.name === _args.newName)) {
        return throwError(
          "Profile field with the same name already exists",
          "PROFILE_FIELD_ALREADY_EXISTS",
        );
      }

      return db
        .update(userProfileField)
        .set({
          name: _args.newName ?? existingField.name,
          value: _args.newValue ?? existingField.value,
        })
        .where(
          and(
            eq(userProfileField.userId, ctx.auth?.user?.id),
            eq(userProfileField.name, _args.name),
          ),
        )
        .returning()
        .then((res) => res[0]);
    },
  }),
);
