import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organisation } from '..';

export const organisationContact = pgTable('organisation_contact_info', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	phone: text('phone').notNull(),
	address: text('address').notNull(),
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
