import { InferSelectModel, relations, sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organisationContact, organisationRegistration } from '..';
import { user } from '../user';

export const organisation = pgTable('organisation', {
	id: text('id')
		.default(sql`gen_random_uuid()`)
		.primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	registrationId: text('registration_id'),
	accountId: text('account_id').notNull(),
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
