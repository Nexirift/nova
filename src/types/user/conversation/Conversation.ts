import { User } from '../..';
import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type UserConversationSchemaType } from '../../../drizzle/schema';

export const UserConversationType = builder.enumType('UserConversationType', {
	values: ['DIRECT', 'GROUP']
});

export const UserConversation =
	builder.objectRef<UserConversationSchemaType>('UserConversation');

UserConversation.implement({
	fields: (t) => ({
		id: t.exposeString('id', { nullable: false }),
		name: t.exposeString('name', { nullable: true }),
		type: t.expose('type', {
			type: UserConversationType,
			nullable: false
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
