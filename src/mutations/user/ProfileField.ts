import { and, eq } from 'drizzle-orm';
import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
import { userProfileField } from '../../drizzle/schema';
import { throwError } from '../../helpers/common';
import { UserProfileField } from '../../types/user/ProfileField';

builder.mutationField('createProfileField', (t) =>
	t.field({
		type: UserProfileField,
		args: {
			name: t.arg.string({ required: true }),
			value: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, _args, ctx: Context) => {
			const existingField = await db.query.userProfileField.findFirst({
				where: (profileField, { eq, and }) =>
					and(
						eq(profileField.userId, ctx.oidc.sub),
						eq(profileField.name, _args.name)
					)
			});

			if (existingField) {
				return throwError(
					'Profile field with the same name already exists',
					'PROFILE_FIELD_ALREADY_EXISTS'
				);
			}

			return db
				.insert(userProfileField)
				.values({
					name: _args.name,
					value: _args.value,
					userId: ctx.oidc.sub
				})
				.returning()
				.then((res) => res[0]);
		}
	})
);

builder.mutationField('updateProfileField', (t) =>
	t.field({
		type: UserProfileField,
		args: {
			name: t.arg.string({ required: true }),
			newName: t.arg.string({ required: false }),
			newValue: t.arg.string({ required: false })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, _args, ctx: Context) => {
			const existingFields = await db.query.userProfileField.findMany({
				where: (profileField, { eq }) =>
					eq(profileField.userId, ctx.oidc.sub)
			});

			const existingField = existingFields.find(
				(field) => field.name === _args.name
			);

			if (!existingField) {
				return throwError(
					'There is no profile field with the given name',
					'PROFILE_FIELD_NOT_FOUND'
				);
			}

			if (existingFields.find((field) => field.name === _args.newName)) {
				return throwError(
					'Profile field with the same name already exists',
					'PROFILE_FIELD_ALREADY_EXISTS'
				);
			}

			return db
				.update(userProfileField)
				.set({
					name: _args.newName ?? existingField.name,
					value: _args.newValue ?? existingField.value
				})
				.where(
					and(
						eq(userProfileField.userId, ctx.oidc.sub),
						eq(userProfileField.name, _args.name)
					)
				)
				.returning()
				.then((res) => res[0]);
		}
	})
);
