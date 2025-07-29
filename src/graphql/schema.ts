import builder from "@/graphql/builder";

import "@/graphql/resolvers";
import "@/graphql/types";

builder.queryType({});
builder.mutationType({});
builder.subscriptionType({});

export default builder.toSchema();
