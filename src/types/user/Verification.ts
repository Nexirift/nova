import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type UserVerification as UserVerificationType } from '../../drizzle/schema';
import { User } from './User';

export const UserVerification =
	builder.objectRef<UserVerificationType>('UserVerification');

UserVerification.implement({
	fields: (t) => ({
		user: t.field({
			type: User,
			resolve: async (_user) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, _user.userId)
				});
				return result!;
			}
		}),
		type: t.exposeString('type'),
		since: t.expose('createdAt', { type: 'Date' })
	})
});
