import { config } from "@/config";
import { Context } from "@/context";
import { db } from "@/db";
import builder from "@/graphql/builder";
import {
  throwError,
  throwFeatureDisabledError,
} from "@/graphql/helpers/common";
import { Post, PostCollection } from "@/graphql/types";
import { postCollection } from "@nexirift/db/schema";

builder.mutationField("createPostCollection", (t) =>
  t.field({
    type: PostCollection,
    args: {
      name: t.arg.string({ required: true }),
      description: t.arg.string(),
      type: t.arg.string({ defaultValue: "PUBLIC" }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, args, ctx: Context) => {
      if (!config.features.posts.collections.enabled)
        return throwFeatureDisabledError();

      const originalPostCollection = await db.query.postCollection.findFirst({
        where: (postCollection, { and, eq }) =>
          and(
            eq(postCollection.name, args.name),
            eq(postCollection.userId, ctx.auth?.user?.id),
          ),
      });

      if (originalPostCollection) {
        return throwError(
          "Post collection already exists.",
          "POST_COLLECTION_ALREADY_EXISTS",
        );
      }

      const newPostCollection = await db
        .insert(postCollection)
        .values({
          name: args.name,
          description: args.description,
          type: args.type as "PUBLIC" | "PRIVATE",
          userId: ctx.auth?.user?.id,
        })
        .returning()
        .execute();

      return newPostCollection[0];
    },
  }),
);
