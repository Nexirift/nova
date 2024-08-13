import { InferSelectModel, relations, sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	boolean,
	pgEnum,
	primaryKey,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const organisationType = pgEnum('organisation_type', [
	'GENERAL',
	'NON-PROFIT'
]);
export const organisationRole = pgEnum('organisation_role', [
	'OWNER',
	'ADMIN',
	'MEMBER'
]);

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
	registration: one(organsiationRegistration, {
		fields: [organisation.registrationId],
		references: [organsiationRegistration.id],
		relationName: 'organisation_registration'
	}),
	contactInfo: one(organisationContactInfo, {
		fields: [organisation.id],
		references: [organisationContactInfo.id],
		relationName: 'organisation_contact_info'
	})
}));

export const organsiationRegistration = pgTable('organisation_registration', {
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

export const organsiationRegistrationRelations = relations(
	organsiationRegistration,
	({ one }) => ({
		organistation: one(organisation, {
			fields: [organsiationRegistration.organisationId],
			references: [organisation.id],
			relationName: 'organisation_registration'
		})
	})
);

export const organisationContactInfo = pgTable('organisation_contact_info', {
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

export const organisationContactInfoRelations = relations(
	organisationContactInfo,
	({ many }) => ({
		organisations: many(organisation, {
			relationName: 'organisation_contact_info'
		})
	})
);

export const organisationMember = pgTable('organisation_member', {
	id: uuid('id').defaultRandom().primaryKey(),
	organisationId: text('organisation_id')
		.notNull()
		.references(() => organisation.id),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	role: organisationRole('organisation_role').notNull(),
	affiliated: boolean('affiliated').notNull().default(false),
	profession: text('profession'),
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

export type Organisation = InferSelectModel<typeof organisation>;
export type OrganisationContactInfo = InferSelectModel<
	typeof organisationContactInfo
>;
export type OrganisationMember = InferSelectModel<typeof organisationMember>;
export type OrganisationRegistration = InferSelectModel<
	typeof organsiationRegistration
>;
