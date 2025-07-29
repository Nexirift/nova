import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { pubsub } from "@/graphql/pubsub";
import { User } from "@/graphql/types";

builder.queryField("user", (t) =>
  t.field({
    type: User,
    args: {
      id: t.arg.string(),
      username: t.arg.string(),
    },
    validate: [
      (args) => !!args.id || !!args.username,
      {
        message: "You must provide an ID or username.",
      },
    ],
    resolve: async (_root, { id, username }) => {
      const user = await db.query.user.findFirst({
        where: (user, { eq }) =>
          id ? eq(user.id, id!) : eq(user.username, username!),
      });

      if (!user) {
        return throwError("User not found.", "USER_NOT_FOUND");
      }

      return user;
    },
  }),
);
