import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type UserConversationParticipantRoleSchemaType } from '../../../drizzle/schema';
import { UserConversationParticipant } from './Participant';
import { UserConversationRole } from './Role';

export const UserConversationParticipantRole =
	builder.objectRef<UserConversationParticipantRoleSchemaType>(
		'UserConversationParticipantRole'
	);

UserConversationParticipantRole.implement({
	fields: (t) => ({
		participant: t.field({
			type: UserConversationParticipant,
			nullable: false,
			resolve: (userConversationParticipant) =>
				db.query.userConversationParticipant
					.findFirst({
						where: (participant, { eq }) =>
							eq(
								participant.id,
								userConversationParticipant.participantId
							)
					})
					.then((result) => result!)
		}),
		role: t.field({
			type: UserConversationRole,
			nullable: true,
			resolve: (userConversationRole) =>
				db.query.userConversationRole
					.findFirst({
						where: (role, { eq }) =>
							eq(role.id, userConversationRole.roleId)
					})
					.then((result) => result!)
		})
	})
});
