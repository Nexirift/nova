import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { userRelationship } from "@nexirift/db/schema";
import { and, eq } from "drizzle-orm";

builder.mutationField("denyFollowRequest", (t) =>
  t.field({
    type: "Boolean",
    args: {
      id: t.arg.string({ required: true }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, args, ctx: Context) => {
      const requestedRelationship = await db.query.userRelationship.findFirst({
        where: (userRelationship, { and }) =>
          and(
            eq(userRelationship.fromId, args.id),
            eq(userRelationship.toId, ctx.auth?.user?.id),
            eq(userRelationship.type, "REQUEST"),
          ),
      });

      if (!requestedRelationship) {
        return throwError(
          "This user does not exist or has not sent a follow request.",
          "FOLLOW_REQUEST_NOT_FOUND",
        );
      }

      await db
        .delete(userRelationship)
        .where(
          and(
            eq(userRelationship.fromId, args.id),
            eq(userRelationship.toId, ctx.auth?.user?.id),
            eq(userRelationship.type, "REQUEST"),
          ),
        )
        .returning()
        .then((res) => res[0]);

      return true;
    },
  }),
);
