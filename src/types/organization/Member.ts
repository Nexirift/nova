import type { OrganizationMemberSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { Organization, User } from '..';
import { builder } from '../../builder';

export const OrganizationMember =
	builder.objectRef<OrganizationMemberSchemaType>('OrganizationMember');

OrganizationMember.implement({
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
		organization: t.field({
			type: Organization,
			nullable: false,
			resolve: async (parent) => {
				const result = await db.query.organization.findFirst({
					where: (organization, { eq }) =>
						eq(organization.id, parent.organizationId)
				});
				return result!;
			}
		}),
		affiliated: t.exposeBoolean('affiliated', { nullable: true }),
		since: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
