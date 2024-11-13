import { InferSelectModel, relations } from 'drizzle-orm';
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organisation } from '..';

export const organisationType = pgEnum('organisation_type', [
	'GENERAL',
	'NON-PROFIT'
]);

export const organisationRegistration = pgTable('organisation_registration', {
	id: uuid('id').defaultRandom().primaryKey(),
	organisationId: text('organisation_id')
		.notNull()
		.references(() => organisation.id),
	number: text('number').notNull(),
	country: text('country').notNull(),
	type: organisationType('organisation_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const organisationRegistrationRelations = relations(
	organisationRegistration,
	({ one }) => ({
		organistation: one(organisation, {
			fields: [organisationRegistration.organisationId],
			references: [organisation.id],
			relationName: 'organisation_registration'
		})
	})
);

export type OrganisationRegistrationSchemaType = InferSelectModel<
	typeof organisationRegistration
>;
