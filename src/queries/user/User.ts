import { db } from '@nexirift/db';
import { builder } from '../../builder';
import type { Context } from '../../context';
import { throwError } from '../../helpers/common';
import { User } from '../../types';

builder.queryField('getUser', (t) =>
	t.field({
		type: User,
		args: {
			id: t.arg.string(),
			username: t.arg.string()
		},
		validate: [
			(args) => !!args.id || !!args.username,
			{
				message: 'You must provide an ID or username.'
			}
		],
		resolve: async (_root, { id, username }) => {
			const user = await db.query.user.findFirst({
				where: (user, { eq }) =>
					id ? eq(user.id, id!) : eq(user.username, username!)
			});

			if (!user) {
				return throwError('User not found.', 'USER_NOT_FOUND');
			}

			return user;
		}
	})
);

builder.queryField('me', (t) =>
	t.field({
		type: User,
		authScopes: {
			loggedIn: true
		},
		resolve: async (_root, _args, ctx: Context) => {
			const user = await db.query.user.findFirst({
				where: (user, { eq }) => eq(user.id, ctx.auth.user.id!)
			});

			if (!user) {
				return throwError('User not found.', 'USER_NOT_FOUND');
			}

			return user;
		}
	})
);
