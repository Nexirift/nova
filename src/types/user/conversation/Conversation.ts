import type { UserConversationSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { builder } from '../../../builder';
import { config } from '../../../config';
import { UserConversationParticipant } from './Participant';
import { UserConversationRole } from './Role';

export const UserConversationType = builder.enumType('UserConversationType', {
	values: ['DIRECT', 'GROUP']
});

export const UserConversation =
	builder.objectRef<UserConversationSchemaType>('UserConversation');

UserConversation.implement({
	authScopes: (t) => {
		if (t.type === 'DIRECT' && !config.features.messaging.direct.enabled) {
			return false;
		}
		if (t.type === 'GROUP' && !config.features.messaging.group.enabled) {
			return false;
		}
		return true;
	},
	fields: (t) => ({
		id: t.exposeString('id', { nullable: false }),
		name: t.exposeString('name', { nullable: true }),
		type: t.expose('type', { type: UserConversationType, nullable: false }),
		participants: t.field({
			type: [UserConversationParticipant],
			nullable: false,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' })
			},
			resolve: async (parent, { first, offset }) =>
				(await db.query.userConversationParticipant.findMany({
					where: (userConversationParticipant, { eq }) =>
						eq(
							userConversationParticipant.conversationId,
							parent.id
						),
					limit: first!,
					offset: offset!,
					with: { user: true }
				}))!
		}),
		roles: t.field({
			type: [UserConversationRole],
			nullable: true,
			resolve: async (parent) =>
				(await db.query.userConversationRole.findMany({
					where: (userConversationRole, { eq }) =>
						eq(userConversationRole.conversationId, parent.id),
					with: { members: true }
				}))!
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
