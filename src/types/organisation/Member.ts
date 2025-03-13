import type { OrganisationMemberSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { Organisation, User } from '..';
import { builder } from '../../builder';

export const OrganisationMember =
	builder.objectRef<OrganisationMemberSchemaType>('OrganisationMember');

OrganisationMember.implement({
	fields: (t) => ({
		user: t.field({
			type: User,
			nullable: false,
			resolve: async (parent) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, parent.userId)
				});
				return result!;
			}
		}),
		organisation: t.field({
			type: Organisation,
			nullable: false,
			resolve: async (parent) => {
				const result = await db.query.organisation.findFirst({
					where: (organisation, { eq }) =>
						eq(organisation.id, parent.organisationId)
				});
				return result!;
			}
		}),
		affiliated: t.exposeBoolean('affiliated', { nullable: false }),
		profession: t.exposeString('profession', { nullable: true }),
		since: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
