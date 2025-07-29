import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { User } from "@/graphql/types";

builder.queryField("me", (t) =>
  t.field({
    type: User,
    authScopes: {
      loggedIn: true,
    },
    resolve: async (_root, _args, ctx: Context) => {
      const user = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, ctx.auth.user.id!),
      });

      if (!user) {
        return throwError("User not found.", "USER_NOT_FOUND");
      }

      return user;
    },
  }),
);
