import { config } from "@/config";
import { db } from "@/db";
import builder from "@/graphql/builder";
import {
  throwError,
  throwFeatureDisabledError,
} from "@/graphql/helpers/common";
import { findPostCollectionById } from "@/graphql/helpers/post/Collection";
import { PostCollectionItem } from "@/graphql/types";
import { postCollectionItem } from "@nexirift/db/schema";
import { and, eq } from "drizzle-orm";

builder.mutationField("removePostFromCollection", (t) =>
  t.field({
    type: PostCollectionItem,
    args: {
      id: t.arg.string({ required: true }),
      postId: t.arg.string({ required: true }),
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
        .delete(postCollectionItem)
        .where(
          and(
            eq(postCollectionItem.collectionId, args.id),
            eq(postCollectionItem.postId, args.postId),
          ),
        )
        .execute();

      return { collectionId: args.id, postId: args.postId };
    },
  }),
);
