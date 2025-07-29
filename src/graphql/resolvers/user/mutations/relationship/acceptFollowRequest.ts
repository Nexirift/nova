import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { UserRelationship } from "@/graphql/types";
import { userRelationship } from "@nexirift/db/schema";
import { and, eq } from "drizzle-orm";

builder.mutationField("acceptFollowRequest", (t) =>
  t.field({
    type: UserRelationship,
    args: {
      id: t.arg.string({ required: true }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, args, ctx: Context) => {
      const requestedRelationship = await db.query.userRelationship.findFirst({
        where: (userRelationship, { and, eq }) =>
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

      return db
        .update(userRelationship)
        .set({ type: "FOLLOW" })
        .where(
          and(
            eq(userRelationship.fromId, args.id),
            eq(userRelationship.toId, ctx.auth?.user?.id),
            eq(userRelationship.type, "REQUEST"),
          ),
        )
        .returning()
        .then((res) => res[0]);
    },
  }),
);
