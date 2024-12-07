import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext, user } from '..';

export const userSetting = pgTable('user_setting', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: citext('user_id')
		.notNull()
		.references(() => user.id),
	key: citext('key').notNull(),
	value: citext('value').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userSettingRelations = relations(userSetting, ({ one }) => ({
	user: one(user, {
		fields: [userSetting.userId],
		references: [user.id],
		relationName: 'user_setting'
	})
}));

export type UserSettingSchemaType = InferSelectModel<typeof userSetting>;
