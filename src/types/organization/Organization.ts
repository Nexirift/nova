import type { OrganizationSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../builder';
import { OrganizationMember } from './Member';

export const Organization =
	builder.objectRef<OrganizationSchemaType>('Organization');

Organization.implement({
	fields: (t) => ({
		owner: t.field({
			type: OrganizationMember,
			nullable: false,
			resolve: async (_organization) => {
				const result = await db.query.organizationMember.findFirst({
					where: (organizationMember, { and, eq }) =>
						and(
							eq(
								organizationMember.organizationId,
								_organization.id
							),
							eq(organizationMember.role, 'owner')
						)
				});
				return result!;
			}
		}),
		members: t.field({
			type: [OrganizationMember],
			nullable: true,
			resolve: async (_organization) => {
				const result = await db.query.organizationMember.findMany({
					where: (organizationMember, { eq }) =>
						eq(organizationMember.organizationId, _organization.id)
				});
				return result!;
			}
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
