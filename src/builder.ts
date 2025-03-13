import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import SmartSubscriptionsPlugin, {
	subscribeOptionsFromIterator
} from '@pothos/plugin-smart-subscriptions';
import ValidationPlugin from '@pothos/plugin-validation';
import { DateTimeResolver } from 'graphql-scalars';
import type { Context } from './context';
import { throwError } from './helpers/common';
import { pubsub } from './pubsub';

export const builder = new SchemaBuilder<{
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
		SmartSubscriptionsPlugin
	],
	validationOptions: {
		// optionally customize how errors are formatted
		validationError: (zodError) => {
			// the default behavior is to just throw the zod error directly
			return zodError;
		}
	},
	scopeAuth: {
		// Recommended when using subscriptions
		// when this is not set, auth checks are run when event is resolved rather than when the subscription is created
		authorizeOnSubscribe: true,
		authScopes: async (ctx) => ({
			loggedIn: !!ctx.auth?.user?.id
		}),
		unauthorizedError: (_, ctx) => {
			if (ctx.auth?.user) {
				return throwError(
					'You do not have permission to access this resource.',
					'PERMISSION_DENIED'
				);
			} else {
				return throwError(
					'You must be logged in to access this resource.',
					'AUTHENTICATION_REQUIRED'
				);
			}
		}
	},
	smartSubscriptions: {
		...subscribeOptionsFromIterator((name) =>
			pubsub.asyncIterableIterator(name)
		)
	}
});

builder.addScalarType('Date', DateTimeResolver, {});

builder.objectType(Error, {
	name: 'Error',
	fields: (t) => ({
		message: t.exposeString('message')
	})
});
