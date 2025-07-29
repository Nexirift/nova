import { config } from "@/config";
import { db } from "@/db";
import type { PostCollectionItemSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import {
  throwError,
  throwFeatureDisabledError,
} from "@/graphql/helpers/common";
import { Post, PostCollection } from "@/graphql/types";

export const PostCollectionItem =
  builder.objectRef<PostCollectionItemSchemaType>("PostCollectionItem");

PostCollectionItem.implement({
  authScopes: async (_parent, context) => {
    if (
      !config.features.posts.collections.enabled ||
      !config.features.posts.enabled
    )
      return throwFeatureDisabledError();

    const collection = await db.query.postCollection.findFirst({
      where: (postCollection, { eq }) =>
        eq(postCollection.id, _parent.collectionId),
    });

    if (
      collection?.type === "PRIVATE" &&
      context.auth?.user.id !== collection?.userId
    ) {
      return throwError("You cannot view this post.", "UNAUTHORIZED");
    }
    return true;
  },
  runScopesOnType: true,
  fields: (t) => ({
    collection: t.field({
      type: PostCollection,
      nullable: false,
      resolve: async (_postCollection) => {
        const result = await db.query.postCollection.findFirst({
          where: (postCollection, { eq }) =>
            eq(postCollection.id, _postCollection.collectionId),
        });
        return result!;
      },
    }),
    post: t.field({
      type: Post,
      nullable: false,
      resolve: async (_post) => {
        const result = await db.query.post.findFirst({
          where: (post, { eq }) => eq(post.id, _post.postId),
        });
        return result!;
      },
    }),
  }),
});
