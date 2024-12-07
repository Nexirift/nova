import { InferSelectModel, relations, sql } from 'drizzle-orm';
import { pgTable, timestamp } from 'drizzle-orm/pg-core';
import {
	citext,
	organisationContact,
	organisationRegistration,
	user
} from '..';

export const organisation = pgTable('organisation', {
	id: citext('id')
		.default(sql`gen_random_uuid()`)
		.primaryKey(),
	name: citext('name').notNull(),
	description: citext('description'),
	registrationId: citext('registration_id'),
	accountId: citext('account_id').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const organisationRelations = relations(organisation, ({ one }) => ({
	account: one(user, {
		fields: [organisation.accountId],
		references: [user.id],
		relationName: 'organisation_account'
	}),
	registration: one(organisationRegistration, {
		fields: [organisation.registrationId],
		references: [organisationRegistration.id],
		relationName: 'organisation_registration'
	}),
	Contact: one(organisationContact, {
		fields: [organisation.id],
		references: [organisationContact.id],
		relationName: 'organisation_contact_info'
	})
}));

export type OrganisationSchemaType = InferSelectModel<typeof organisation>;
