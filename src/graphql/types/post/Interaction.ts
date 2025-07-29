import { config } from "@/config";
import { db } from "@/db";
import type { PostInteractionSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { throwFeatureDisabledError } from "@/graphql/helpers/common";
import { Post, User } from "@/graphql/types";

export const PostInteractionType = builder.enumType("PostInteractionType", {
  values: ["LIKE", "REPOST"],
});

export const PostInteraction =
  builder.objectRef<PostInteractionSchemaType>("PostInteraction");

PostInteraction.implement({
  authScopes: async () => {
    if (!config.features.posts.enabled) return throwFeatureDisabledError();

    return true;
  },
  fields: (t) => ({
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
    user: t.field({
      type: User,
      nullable: false,
      resolve: async (_user) => {
        const result = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, _user.userId),
        });
        return result!;
      },
    }),
    type: t.expose("type", { type: PostInteractionType, nullable: false }),
  }),
});
