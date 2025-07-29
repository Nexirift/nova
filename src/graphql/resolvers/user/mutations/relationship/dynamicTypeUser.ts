import { Context } from "@/context";
import builder from "@/graphql/builder";
import { modifyRelationship } from "@/graphql/helpers/user/Relationship";
import { UserRelationship } from "@/graphql/types";

// Define the possible relationship types
const relationshipTypes = [
  "BLOCK",
  "UNBLOCK",
  "MUTE",
  "UNMUTE",
  "FOLLOW",
  "UNFOLLOW",
] as const;

// Create mutation fields for each relationship type
relationshipTypes.forEach((type) => {
  builder.mutationField(`${type.toLowerCase()}User`, (t) =>
    t.field({
      type: UserRelationship,
      args: {
        id: t.arg.string({ required: true }),
        reason: t.arg.string(),
      },
      authScopes: { loggedIn: true },
      resolve: async (_root, args, ctx: Context) =>
        modifyRelationship(ctx, args, type),
    }),
  );
});
