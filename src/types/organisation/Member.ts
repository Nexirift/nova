import { Organisation, User } from '..';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import { type OrganisationMember as OrganisationMemberType } from '../../drizzle/schema';

export const OrganisationMember =
	builder.objectRef<OrganisationMemberType>('OrganisationMember');

OrganisationMember.implement({
	fields: (t) => ({
		user: t.field({
			type: User,
			resolve: async (parent) => {
				const result = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, parent.userId)
				});
				return result!;
			}
		}),
		organisation: t.field({
			type: Organisation,
			resolve: async (parent) => {
				const result = await db.query.organisation.findFirst({
					where: (organisation, { eq }) =>
						eq(organisation.id, parent.organisationId)
				});
				return result!;
			}
		}),
		affiliated: t.exposeBoolean('affiliated'),
		profession: t.exposeString('profession', { nullable: true }),
		since: t.expose('createdAt', { type: 'Date' })
	})
});
