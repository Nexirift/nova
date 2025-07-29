import type { Context } from "@/context";
import { throwError } from "@/graphql/helpers/common";
import { pubsub } from "@/graphql/pubsub";
import SchemaBuilder from "@pothos/core";
import ErrorsPlugin from "@pothos/plugin-errors";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import SimpleObjectsPlugin from "@pothos/plugin-simple-objects";
import SmartSubscriptionsPlugin, {
  subscribeOptionsFromIterator,
} from "@pothos/plugin-smart-subscriptions";
import ValidationPlugin from "@pothos/plugin-validation";
import { DateTimeResolver } from "graphql-scalars";

const builder = new SchemaBuilder<{
  Context: Context;
  Scalars: {
    Date: {
      Input: Date;
      Output: Date;
    };
  };
  AuthScopes: {
    loggedIn: boolean;
  };
}>({
  plugins: [
    ScopeAuthPlugin,
    ValidationPlugin,
    ErrorsPlugin,
    SmartSubscriptionsPlugin,
    SimpleObjectsPlugin,
  ],
  validationOptions: {
    // optionally customize how errors are formatted
    validationError: (zodError) => {
      // the default behavior is to just throw the zod error directly
      return zodError;
    },
  },
  scopeAuth: {
    // Recommended when using subscriptions
    // when this is not set, auth checks are run when event is resolved rather than when the subscription is created
    authorizeOnSubscribe: true,
    authScopes: async (ctx) => ({
      loggedIn: !!ctx.auth?.user?.id,
    }),
    unauthorizedError: (_, ctx) => {
      if (ctx.auth?.user) {
        return throwError(
          "You do not have permission to access this resource.",
          "PERMISSION_DENIED",
        );
      } else {
        return throwError(
          "You must be logged in to access this resource.",
          "AUTHENTICATION_REQUIRED",
        );
      }
    },
  },
  smartSubscriptions: {
    ...subscribeOptionsFromIterator((name, { pubsub }) => {
      console.log(name, pubsub);
      return pubsub.asyncIterableIterator(name);
    }),
  },
});

builder.addScalarType("Date", DateTimeResolver, {});

builder.objectType(Error, {
  name: "Error",
  fields: (t) => ({
    message: t.exposeString("message"),
  }),
});

export default builder;
