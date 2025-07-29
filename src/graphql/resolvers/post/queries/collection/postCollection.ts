import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { PostCollection } from "@/graphql/types";

builder.queryField("getPostCollection", (t) =>
  t.field({
    type: PostCollection,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, { id }) => {
      const postCollection = await db.query.postCollection.findFirst({
        where: (postCollection, { eq }) => eq(postCollection.id, id!),
      });

      if (!postCollection) {
        return throwError(
          "Post collection not found.",
          "POST_COLLECTION_NOT_FOUND",
        );
      }

      return postCollection;
    },
  }),
);
