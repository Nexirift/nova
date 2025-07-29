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

builder.mutationField("addPostToCollection", (t) =>
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

      const newPostCollectionItem = await db
        .insert(postCollectionItem)
        .values({
          collectionId: args.id,
          postId: args.postId,
        })
        .returning()
        .execute();

      return newPostCollectionItem[0];
    },
  }),
);
