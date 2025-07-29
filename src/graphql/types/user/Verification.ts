import { config } from "@/config";
import { db } from "@/db";
import type { UserVerificationSchemaType } from "@/db/schema";
import { userVerificationType } from "@/db/schema";
import builder from "@/graphql/builder";
import { throwFeatureDisabledError } from "@/graphql/helpers/common";
import { User } from "@/graphql/types";

export const UserVerificationType = builder.enumType("UserVerificationType", {
  values: userVerificationType.enumValues,
});

export const UserVerification =
  builder.objectRef<UserVerificationSchemaType>("UserVerification");

UserVerification.implement({
  authScopes: async () => {
    if (!config.features.verification.enabled)
      return throwFeatureDisabledError();

    return true;
  },
  fields: (t) => ({
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
    type: t.expose("type", {
      type: UserVerificationType,
      nullable: false,
    }),
    since: t.expose("createdAt", { type: "Date", nullable: false }),
  }),
});
