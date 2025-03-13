import { db } from '@nexirift/db';
import { throwError } from '../common';

const validPermissions = [
	'ADD_PARTICIPANTS',
	'REMOVE_PARTICIPANTS',
	'SEND_MESSAGES',
	'CREATE_ROLES'
];

const getConversation = async (id: string) => {
	const conversation = await db.query.userConversation.findFirst({
		where: (userConversation, { eq }) => eq(userConversation.id, id)
	});
	if (!conversation)
		return throwError(
			'The conversation does not exist.',
			'CONVERSATION_NOT_FOUND'
		);
	return conversation;
};

const getParticipant = async (userId: string, conversationId: string) => {
	await getConversation(conversationId);
	const participant = await db.query.userConversationParticipant.findFirst({
		where: (userConversationParticipant, { and, eq }) =>
			and(
				eq(userConversationParticipant.conversationId, conversationId),
				eq(userConversationParticipant.userId, userId)
			),
		with: {
			roles: {
				with: {
					role: {
						with: {
							members: true
						}
					}
				}
			}
		}
	});
	if (!participant)
		return throwError(
			'You must be a participant in this conversation to proceed with this action.',
			'CONVERSATION_PARTICIPANT_REQUIRED'
		);
	return participant;
};

const getPermissions = async (conversationId: string, userId: string) => {
	const participant = await getParticipant(userId, conversationId);
	const perms = [];
	for (const role of participant?.roles ?? []) {
		for (const permission of JSON.parse(role.role.permissions)) {
			perms.push(permission);
		}
	}
	return perms;
};

const checkPermissions = async (
	permissions: string[],
	conversationId: string,
	userId: string
) => {
	const _permissions = await getPermissions(conversationId, userId);
	const missing = permissions.filter((p) => !_permissions.includes(p));

	if (missing.length > 0) {
		return throwError(
			`You do not have permission to proceed with this action. Missing permission(s): ${missing.join(
				', '
			)}`,
			'CONVERSATION_PERMISSIONS_MISSING'
		);
	}
};

export {
	checkPermissions,
	getConversation,
	getParticipant,
	getPermissions,
	validPermissions
};
