import type { UserVerificationSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { config } from '../../config';
import { throwFeatureDisabledError } from '../../helpers/common';
import { User } from './User';

export const UserVerificationType = builder.enumType('UserVerificationType', {
	values: ['NOTABLE', 'BUSINESS', 'OFFICIAL', 'TESTER']
});

export const UserVerification =
	builder.objectRef<UserVerificationSchemaType>('UserVerification');

UserVerification.implement({
	authScopes: async () => {
		if (!config.features.verification.enabled)
			return throwFeatureDisabledError();

		return true;
	},
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
