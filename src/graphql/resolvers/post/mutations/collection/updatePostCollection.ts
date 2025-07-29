import { config } from "@/config";
import { db } from "@/db";
import builder from "@/graphql/builder";
import {
  throwError,
  throwFeatureDisabledError,
} from "@/graphql/helpers/common";
import { findPostCollectionById } from "@/graphql/helpers/post/Collection";
import { PostCollection } from "@/graphql/types";
import { postCollection } from "@nexirift/db/schema";
import { eq } from "drizzle-orm";

builder.mutationField("updatePostCollection", (t) =>
  t.field({
    type: PostCollection,
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      description: t.arg.string(),
      type: t.arg.string({ defaultValue: "PUBLIC" }),
    },
    authScopes: { loggedIn: true },
    resolve: async (_root, args) => {
      if (!config.features.posts.collections.enabled)
        return throwFeatureDisabledError();

      const originalPostCollection = await findPostCollectionById(args.id);

      if (!originalPostCollection) {
        return throwError(
          "Post collection not found.",
          "POST_COLLECTION_NOT_FOUND",
        );
      }

      const updatedPostCollection = await db
        .update(postCollection)
        .set({
          name: args.name,
          description: args.description,
          type: args.type as "PUBLIC" | "PRIVATE",
        })
        .where(eq(postCollection.id, args.id))
        .returning()
        .execute();

      return updatedPostCollection[0];
    },
  }),
);
