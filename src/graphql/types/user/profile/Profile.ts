import { db } from "@/db";
import type { UserProfileSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { privacyGuardian } from "@/graphql/lib/guardian";
import { User, UserProfileField } from "@/graphql/types";

export const UserProfile =
  builder.objectRef<UserProfileSchemaType>("UserProfile");

UserProfile.implement({
  fields: (t) => ({
    user: t.field({
      type: User,
      nullable: false,
      resolve: async (profile) => {
        const result = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.id, profile.userId),
        });
        return result!;
      },
    }),
    bio: t.exposeString("bio", { nullable: true }),
    extendedBio: t.exposeString("extendedBio", { nullable: true }),
    profession: t.exposeString("profession", { nullable: true }),
    location: t.exposeString("location", { nullable: true }),
    website: t.exposeString("website", { nullable: true }),
    banner: t.exposeString("banner", { nullable: true }),
    background: t.exposeString("background", { nullable: true }),
    profileFields: t.field({
      type: [UserProfileField],
      nullable: true,
      authScopes: (parent, _args, context) =>
        privacyGuardian({ id: parent.userId }, context.auth),
      unauthorizedResolver: () => [],
      resolve: async (profile) => {
        const result = await db.query.userProfileField.findMany({
          where: (userProfileField, { eq }) =>
            eq(userProfileField.userId, profile.userId),
          orderBy: (userProfileField, { asc }) => [
            asc(userProfileField.createdAt),
          ],
        });
        return result!;
      },
    }),
  }),
});
