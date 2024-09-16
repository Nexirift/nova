import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type UserProfileField as UserProfileFieldType } from '../../drizzle/schema';
import { User } from './User';

export const UserProfileField =
	builder.objectRef<UserProfileFieldType>('UserProfileField');

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
