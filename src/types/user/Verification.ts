import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type UserVerificationSchemaType } from '../../drizzle/schema';
import { User } from './User';

export const UserVerificationType = builder.enumType('UserVerificationType', {
	values: ['NOTABLE', 'BUSINESS', 'OFFICIAL', 'TESTER']
});

export const UserVerification =
	builder.objectRef<UserVerificationSchemaType>('UserVerification');

UserVerification.implement({
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
		type: t.expose('type', {
			type: UserVerificationType,
			nullable: false
		}),
		since: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
