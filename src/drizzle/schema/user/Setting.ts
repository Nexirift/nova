import { InferSelectModel, relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '.';

export const userSetting = pgTable('user_setting', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	key: text('key').notNull(),
	value: text('value').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const userSettingRelations = relations(userSetting, ({ one }) => ({
	user: one(user, {
		fields: [userSetting.userId],
		references: [user.id],
		relationName: 'user_setting'
	})
}));

export type UserSetting = InferSelectModel<typeof userSetting>;
