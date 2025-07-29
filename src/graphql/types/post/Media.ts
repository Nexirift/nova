import { db } from "@/db";
import type { PostMediaSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { Post } from "@/graphql/types";

export const PostMedia = builder.objectRef<PostMediaSchemaType>("PostMedia");

PostMedia.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    post: t.field({
      type: Post,
      resolve: async (_post) => {
        const result = await db.query.post.findFirst({
          where: (post, { eq }) => eq(post.id, _post.postId ?? ""),
        });
        return result!;
      },
    }),
    url: t.exposeString("url"),
    alt: t.exposeString("alt"),
    createdAt: t.expose("createdAt", { type: "Date" }),
  }),
});
