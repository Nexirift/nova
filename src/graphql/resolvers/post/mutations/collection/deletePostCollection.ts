import { config } from "@/config";
import { db } from "@/db";
import builder from "@/graphql/builder";
import {
  throwError,
  throwFeatureDisabledError,
} from "@/graphql/helpers/common";
import { findPostCollectionById } from "@/graphql/helpers/post/Collection";
import { postCollection } from "@nexirift/db/schema";
import { eq } from "drizzle-orm";

builder.mutationField("deletePostCollection", (t) =>
  t.field({
    type: "Boolean",
    args: {
      id: t.arg.string({ required: true }),
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

      await db
        .delete(postCollection)
        .where(eq(postCollection.id, args.id))
        .execute();

      return true;
    },
  }),
);
