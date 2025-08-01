import type { Context } from "@/context";
import { db } from "@/db";
import type { UserSchemaType } from "@/db/schema";
import { post, postInteraction, userRelationship } from "@/db/schema";
import builder from "@/graphql/builder";
import {
  getCompleteRelationshipStats,
  UserRelationshipStats,
} from "@/graphql/helpers/user/Relationship";
import { privacyGuardian } from "@/graphql/lib/guardian";
import {
  Organization,
  OrganizationMember,
  Post,
  PostInteraction,
  PostMedia,
  TopicUser,
  UserProfile,
  UserRelationship,
  UserRelationshipDirection,
  UserRelationshipType,
  UserVerification,
} from "@/graphql/types";
import { and, count, eq } from "drizzle-orm";

export const UserType = builder.enumType("UserType", {
  values: ["PUBLIC", "PRIVATE"],
});

export const User = builder.objectRef<UserSchemaType>("User");

User.implement({
  fields: (t) => ({
    id: t.exposeString("id", {
      nullable: false,
    }),
    username: t.exposeString("displayUsername"),
    displayName: t.exposeString("displayName", { nullable: true }),
    avatar: t.exposeString("avatar", { nullable: true }),
    type: t.expose("type", { type: UserType, nullable: true }),
    verification: t.field({
      type: UserVerification,
      nullable: true,
      resolve: async (user) => {
        return await db.query.userVerification.findFirst({
          where: (userVerification, { eq }) =>
            eq(userVerification.userId, user.id),
        });
      },
    }),
    profile: t.field({
      type: UserProfile,
      nullable: true,
      authScopes: (parent, _args, context) =>
        privacyGuardian({ id: parent.id }, context.auth),
      unauthorizedResolver: () => null,
      resolve: async (user) => {
        return await db.query.userProfile.findFirst({
          where: (userProfile, { eq }) => eq(userProfile.userId, user.id),
        });
      },
    }),
    organizations: t.field({
      type: [OrganizationMember],
      nullable: true,
      resolve: async (user) => {
        return await db.query.organizationMember.findMany({
          where: (organization, { eq }) => eq(organization.userId, user.id),
        });
      },
    }),
    organization: t.field({
      type: Organization,
      nullable: true,
      resolve: async (user) => {
        const member = await db.query.organizationMember.findFirst({
          where: (organizationMember, { and, eq }) =>
            and(
              eq(organizationMember.userId, user.id),
              eq(organizationMember.role, "owner"),
            ),
        });

        if (!member) return null;

        const org = await db.query.organization.findFirst({
          where: (organization, { eq }) =>
            eq(organization.id, member.organizationId),
        });

        return org;
      },
    }),
    posts: t.field({
      type: [Post],
      nullable: true,
      args: {
        first: t.arg({ type: "Int" }),
        offset: t.arg({ type: "Int" }),
        includeReposts: t.arg({ type: "Boolean", defaultValue: true }),
      },
      authScopes: (parent, _args, context) =>
        privacyGuardian(parent, context.auth),
      unauthorizedResolver: () => [],
      resolve: async (user, args) => {
        const first = args.first ?? 10;
        const offset = args.offset ?? 0;
        const includeReposts = args.includeReposts ?? true;

        // Get regular posts
        const posts = await db.query.post.findMany({
          where: (post, { and, eq, isNull, or }) =>
            and(
              eq(post.authorId, user.id),
              or(isNull(post.parentId), eq(post.quoted, true)),
              eq(post.deleted, false),
              eq(post.published, true),
            ),
          orderBy: (post, { desc }) => [desc(post.createdAt)],
          // Only apply limit/offset immediately if we're not combining with reposts
          limit: includeReposts ? undefined : first,
          offset: includeReposts ? undefined : offset,
        });

        if (!includeReposts) {
          return posts;
        }

        // Get reposts if requested
        const repostInteractions = await db.query.postInteraction.findMany({
          where: (interaction, { and, eq }) =>
            and(
              eq(interaction.userId, user.id),
              eq(interaction.type, "REPOST"),
            ),
          with: {
            post: true,
          },
        });

        // Type-safe filtering and mapping of reposts
        const validReposts = repostInteractions
          .filter(
            (interaction) =>
              interaction.post &&
              !interaction.post.deleted &&
              interaction.post.published,
          )
          .map((interaction) => ({
            ...interaction.post!,
            repostedAt: interaction.createdAt,
          }));

        // Combine regular posts with reposts
        const postsWithRepostAtNull = posts.map((post) => ({
          ...post,
          repostedAt: null as Date | null,
        }));

        const combined = [...postsWithRepostAtNull, ...validReposts];

        // Sort by post date or repost date, whichever is more recent
        combined.sort((a, b) => {
          const dateA = a.repostedAt || a.createdAt;
          const dateB = b.repostedAt || b.createdAt;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        // Apply pagination after sorting
        return combined.slice(offset, offset + first);
      },
    }),
    replies: t.field({
      type: [Post],
      nullable: true,
      args: {
        first: t.arg({ type: "Int" }),
        offset: t.arg({ type: "Int" }),
      },
      authScopes: (parent, _args, context) =>
        privacyGuardian(parent, context.auth),
      unauthorizedResolver: () => [],
      resolve: async (user, args) => {
        const { first = 10, offset = 0 } = args;
        return await db.query.post.findMany({
          where: (post, { and, eq, isNotNull }) =>
            and(
              eq(post.authorId, user.id),
              isNotNull(post.parentId),
              eq(post.deleted, false),
              eq(post.published, true),
            ),
          orderBy: (post, { desc }) => [desc(post.createdAt)],
          limit: first ?? 10,
          offset: offset ?? 0,
        });
      },
    }),
    media: t.field({
      type: [PostMedia],
      nullable: true,
      authScopes: (parent, _args, context) =>
        privacyGuardian(parent, context.auth),
      unauthorizedResolver: () => [],
      resolve: async (user) => {
        const posts = await db.query.post.findMany({
          where: (post, { eq }) => eq(post.authorId, user.id),
          with: {
            media: true,
          },
        });

        return posts.flatMap((post) => post.media || []);
      },
    }),
    interactions: t.field({
      type: [PostInteraction],
      nullable: true,
      authScopes: (parent, _args, context) =>
        privacyGuardian(parent, context.auth),
      args: {
        first: t.arg({ type: "Int" }),
        offset: t.arg({ type: "Int" }),
        type: t.arg({ type: "String" }),
      },
      unauthorizedResolver: () => [],
      resolve: async (user, args) => {
        const { first = 10, offset = 0, type } = args;
        const interactionType = type as "LIKE" | "REPOST" | undefined;

        return await db.query.postInteraction.findMany({
          where: (postInteraction, { and, eq }) => {
            const conditions = [eq(postInteraction.userId, user.id)];

            if (interactionType) {
              conditions.push(eq(postInteraction.type, interactionType));
            }

            return and(...conditions);
          },
          with: {
            post: true,
          },
          limit: first ?? 10,
          offset: offset ?? 0,
        });
      },
    }),
    relationships: t.field({
      type: [UserRelationship],
      nullable: true,
      args: {
        first: t.arg({ type: "Int" }),
        after: t.arg({ type: "Int" }),
        type: t.arg({ type: UserRelationshipType }),
        direction: t.arg({
          type: UserRelationshipDirection,
        }),
      },
      authScopes: (parent, _args, context) =>
        privacyGuardian(parent, context.auth),
      unauthorizedResolver: () => [],
      resolve: async (user, args, context: Context) => {
        // Privacy check was already done via authScopes
        const { type, direction, first = 10, after = 0 } = args;
        const isIncoming = direction === "INCOMING";
        const isAuthenticatedUser = user.id === context.auth?.user?.id;

        // Security check for sensitive relationship types
        const isSensitiveType = type === "BLOCK" || type === "MUTE";
        if (
          (isSensitiveType && (isIncoming || !isAuthenticatedUser)) ||
          (type === "REQUEST" && !isAuthenticatedUser)
        ) {
          return [];
        }

        // Determine which ID to use in the query based on direction
        const directionCondition = isIncoming
          ? eq(userRelationship.toId, user.id)
          : eq(userRelationship.fromId, user.id);

        return await db.query.userRelationship.findMany({
          where: (userRelationship, { eq, and }) => {
            return type
              ? and(directionCondition, eq(userRelationship.type, type))
              : directionCondition;
          },
          with: {
            // Only load the needed relationship direction
            from: isIncoming ? true : undefined,
            to: !isIncoming ? true : undefined,
          },
          limit: first ?? 10,
          offset: after ?? 0,
        });
      },
    }),
    relationshipStats: t.field({
      type: UserRelationshipStats,
      resolve: async (user, _, ctx) =>
        await getCompleteRelationshipStats(user.id, ctx.auth?.user?.id),
    }),
    createdAt: t.expose("createdAt", { type: "Date", nullable: false }),
    updatedAt: t.expose("updatedAt", { type: "Date", nullable: false }),
    likesCount: t.field({
      type: "Int",
      nullable: false,
      resolve: async (user) => {
        await db.select({ count: count() }).from(postInteraction);

        const result = await db
          .select({ count: count() })
          .from(postInteraction)
          .where(
            and(
              eq(postInteraction.userId, user.id),
              eq(postInteraction.type, "LIKE"),
            ),
          );
        return result[0]?.count ?? 0;
      },
    }),
    postsCount: t.field({
      type: "Int",
      nullable: false,
      resolve: async (user) => {
        const result = await db
          .select({ count: count() })
          .from(post)
          .where(eq(post.authorId, user.id));
        return result[0]?.count ?? 0;
      },
    }),
    attributes: t.stringList({
      resolve: (p) => {
        try {
          return JSON.parse(p.attributes ?? "[]") ?? [];
        } catch {
          return [];
        }
      },
      nullable: false,
    }),
    topics: t.field({
      type: [TopicUser],
      nullable: true,
      resolve: async (user) => {
        const result = await db.query.topicUser.findMany({
          where: (topic, { eq }) => eq(topic.userId, user.id),
        });
        return result!;
      },
    }),
  }),
});
