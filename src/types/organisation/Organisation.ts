import type { OrganisationSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { User } from '..';
import { builder } from '../../builder';
import { OrganisationMember } from './Member';

export const Organisation =
	builder.objectRef<OrganisationSchemaType>('Organisation');

Organisation.implement({
	fields: (t) => ({
		account: t.field({
			type: User,
			nullable: false,
			resolve: async (_user) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, _user.accountId)
				});
				return result!;
			}
		}),
		members: t.field({
			type: [OrganisationMember],
			nullable: true,
			resolve: async (_organisation) => {
				const result = await db.query.organisationMember.findMany({
					where: (organisationMember, { eq }) =>
						eq(organisationMember.organisationId, _organisation.id),
					with: {
						user: true
					}
				});
				return result!;
			}
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
