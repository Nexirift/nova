import { db } from "@/db";
import type {
  TopicPostSchemaType,
  TopicSchemaType,
  TopicUserSchemaType,
} from "@/db/schema";
import builder from "@/graphql/builder";
import { Post, User } from "@/graphql/types";

export const Topic = builder.objectRef<TopicSchemaType>("Topic");

Topic.implement({
  fields: (t) => ({
    name: t.exposeString("name", { nullable: false }),
    description: t.exposeString("description", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "Date", nullable: false }),
    updatedAt: t.expose("updatedAt", { type: "Date", nullable: false }),
  }),
});

export const TopicUser = builder.objectRef<TopicUserSchemaType>("TopicUser");

TopicUser.implement({
  fields: (t) => ({
    user: t.field({
      type: User,
      nullable: false,
      resolve: async (parent) => {
        const result = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, parent.userId),
        });
        return result!;
      },
    }),
    createdAt: t.expose("createdAt", { type: "Date", nullable: false }),
    updatedAt: t.expose("updatedAt", { type: "Date", nullable: false }),
  }),
});

export const TopicPost = builder.objectRef<TopicPostSchemaType>("TopicPost");

TopicPost.implement({
  fields: (t) => ({
    post: t.field({
      type: Post,
      nullable: false,
      resolve: async (parent) => {
        const result = await db.query.post.findFirst({
          where: (post, { eq }) => eq(post.id, parent.postId),
        });
        return result!;
      },
    }),
    createdAt: t.expose("createdAt", { type: "Date", nullable: false }),
    updatedAt: t.expose("updatedAt", { type: "Date", nullable: false }),
  }),
});
