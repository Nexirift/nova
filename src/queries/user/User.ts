import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
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
		resolve: async (_root, { id, username }, ctx: Context) => {
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
				where: (user, { eq }) => eq(user.id, ctx.oidc.sub)
			});

			if (!user) {
				return throwError(
					'This user has not been synced to the database yet.',
					'USER_NOT_SYNCED'
				);
			}

			return user;
		}
	})
);
