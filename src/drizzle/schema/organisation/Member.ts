import { InferSelectModel, relations } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, organisation, user } from '..';

export const organisationMemberRole = pgEnum('organisation_member_role', [
	'OWNER',
	'ADMIN',
	'MEMBER'
]);

export const organisationMember = pgTable('organisation_member', {
	id: uuid('id').defaultRandom().primaryKey(),
	organisationId: citext('organisation_id')
		.notNull()
		.references(() => organisation.id),
	userId: citext('user_id')
		.notNull()
		.references(() => user.id),
	role: organisationMemberRole('organisation_member_role').notNull(),
	affiliated: boolean('affiliated').notNull().default(false),
	profession: citext('profession'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const organisationMemberRelations = relations(
	organisationMember,
	({ one }) => ({
		organisation: one(organisation, {
			fields: [organisationMember.organisationId],
			references: [organisation.id],
			relationName: 'organisation_member'
		}),
		user: one(user, {
			fields: [organisationMember.userId],
			references: [user.id],
			relationName: 'organisation_member'
		})
	})
);

export type OrganisationMemberSchemaType = InferSelectModel<
	typeof organisationMember
>;
