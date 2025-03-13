import type { UserConversationRoleSchemaType } from '@nexirift/db';
import { db } from '@nexirift/db';
import { UserConversation } from '../..';
import { builder } from '../../../builder';
import { UserConversationParticipantRole } from './ParticipantRole';

export const UserConversationRole =
	builder.objectRef<UserConversationRoleSchemaType>('UserConversationRole');

UserConversationRole.implement({
	fields: (t) => ({
		id: t.exposeString('id'),
		name: t.exposeString('name'),
		description: t.exposeString('description'),
		conversation: t.field({
			type: UserConversation,
			resolve: async (userConversationRole) => {
				return await db.query.userConversation.findFirst({
					where: (userConversation, { eq }) =>
						eq(
							userConversation.id,
							userConversationRole.conversationId
						)
				});
			}
		}),
		members: t.field({
			type: [UserConversationParticipantRole],
			resolve: async (userConversationParticipantRole) => {
				return await db.query.userConversationParticipantRole.findMany({
					where: (userConversationParticipant, { eq }) =>
						eq(
							userConversationParticipant.roleId,
							userConversationParticipantRole.id
						)
				});
			}
		}),
		default: t.exposeBoolean('default'),
		permissions: t.field({
			type: ['String'],
			nullable: false,
			resolve: (userConversationRole) => {
				return JSON.parse(userConversationRole.permissions);
			}
		})
	})
});
