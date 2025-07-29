import { db } from "@/db";
import builder from "@/graphql/builder";
import { throwError } from "@/graphql/helpers/common";
import { Post } from "@/graphql/types";

builder.queryField("post", (t) =>
  t.field({
    type: Post,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, { id }) => {
      const post = await db.query.post.findFirst({
        where: (post, { eq }) => eq(post.id, id!),
      });

      if (!post) {
        return throwError("Post not found.", "POST_NOT_FOUND");
      }

      return post;
    },
  }),
);
