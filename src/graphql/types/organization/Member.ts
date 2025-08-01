import { db } from "@/db";
import type { OrganizationMemberSchemaType } from "@/db/schema";
import builder from "@/graphql/builder";
import { Organization, User } from "@/graphql/types";

export const OrganizationMember =
  builder.objectRef<OrganizationMemberSchemaType>("OrganizationMember");

OrganizationMember.implement({
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
    organization: t.field({
      type: Organization,
      nullable: false,
      resolve: async (parent) => {
        const result = await db.query.organization.findFirst({
          where: (organization, { eq }) =>
            eq(organization.id, parent.organizationId),
        });
        return result!;
      },
    }),
    affiliated: t.exposeBoolean("affiliated", { nullable: true }),
    since: t.expose("createdAt", { type: "Date", nullable: false }),
  }),
});
