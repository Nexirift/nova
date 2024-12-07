import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, organisation } from '..';

export const organisationContact = pgTable('organisation_contact_info', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: citext('name').notNull(),
	email: citext('email').notNull(),
	phone: citext('phone').notNull(),
	address: citext('address').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const organisationContactRelations = relations(
	organisationContact,
	({ many }) => ({
		organisations: many(organisation, {
			relationName: 'organisation_contact_info'
		})
	})
);

export type OrganisationContactSchemaType = InferSelectModel<
	typeof organisationContact
>;
