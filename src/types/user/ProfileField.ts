import type { UserProfileFieldSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { User } from './User';

export const UserProfileField =
	builder.objectRef<UserProfileFieldSchemaType>('UserProfileField');

UserProfileField.implement({
	fields: (t) => ({
		user: t.field({
			type: User,
			nullable: false,
			resolve: async (_user) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, _user.userId)
				});
				return result!;
			}
		}),
		name: t.exposeString('name', { nullable: false }),
		value: t.exposeString('value', { nullable: false }),
		spotlighted: t.exposeBoolean('spotlighted', { nullable: false })
	})
});
