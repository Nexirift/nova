import {
	db,
	userConversation,
	userConversationMessage,
	userConversationParticipant,
	userConversationParticipantRole,
	userConversationRole
} from '@nexirift/db';
import { and, eq } from 'drizzle-orm';
import { builder } from '../../builder';
import type { Context } from '../../context';
import { throwError } from '../../helpers/common';
import {
	checkPermissions,
	getConversation,
	getParticipant,
	validPermissions
} from '../../helpers/user/Conversation';
import { pubsub } from '../../pubsub';
import {
	UserConversation,
	UserConversationParticipantRole,
	UserConversationRole,
	UserConversationType
} from '../../types';
import { UserConversationMessage } from '../../types/user/conversation/Message';
import { UserConversationParticipant } from '../../types/user/conversation/Participant';

const validateParticipants = (
	participants: string[],
	currentUserId: string
) => {
	if (!participants.includes(currentUserId)) participants.push(currentUserId);
	if (participants.length < 2)
		throwError(
			'A conversation must have at least 2 participants.',
			'CONVERSATION_MIN_PARTICIPANTS'
		);
};

const checkDirectConversation = async (participants: string[]) => {
	if (participants.length > 2)
		throwError(
			'A direct conversation can only have 2 participants.',
			'CONVERSATION_DIRECT_MAX_PARTICIPANTS'
		);
	const directConversations = await db.query.userConversation.findMany({
		where: (userConversation, { eq }) =>
			eq(userConversation.type, 'DIRECT'),
		with: { participants: { columns: { userId: true } } }
	});
	const existingConversation = directConversations.find((conversation) =>
		conversation.participants.every((participant) =>
			participants.includes(participant.userId)
		)
	);
	if (existingConversation)
		throwError(
			'You are already in a direct conversation with one of the other participants.',
			'CONVERSATION_ALREADY_IN_DIRECT'
		);
};

const createConversation = async (
	type: string,
	name: string | null,
	participants: string[]
) => {
	const conversation = await db
		.insert(userConversation)
		.values({
			name: type === 'DIRECT' ? null : name,
			type: type as 'DIRECT' | 'GROUP'
		})
		.returning()
		.then((res) => res[0]);

	if (!conversation) {
		throwError(
			'Failed to create conversation.',
			'CONVERSATION_CREATION_FAILED'
		);
		return;
	}

	await db.insert(userConversationParticipant).values(
		participants.map((userId) => ({
			conversationId: conversation.id,
			userId
		}))
	);

	return db.query.userConversation.findFirst({
		where: (userConversation, { eq }) =>
			eq(userConversation.id, conversation.id)
	});
};

builder.mutationField('createUserConversation', (t) =>
	t.field({
		type: UserConversation,
		args: {
			name: t.arg.string({ required: false }),
			type: t.arg({ type: UserConversationType, required: true }),
			participants: t.arg.stringList({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			const participants = args.participants.map((id) => id.toString());
			validateParticipants(participants, ctx.auth?.user?.id);

			if (args.type === 'DIRECT')
				await checkDirectConversation(participants);

			return createConversation(
				args.type,
				args.name ?? null,
				participants
			);
		}
	})
);

builder.mutationField('createUserConversationMessage', (t) =>
	t.field({
		type: UserConversationMessage,
		args: {
			content: t.arg.string({ required: true }),
			conversationId: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			await checkPermissions(
				['SEND_MESSAGES'],
				args.conversationId,
				ctx.auth?.user?.id
			);

			const message = await db
				.insert(userConversationMessage)
				.values({
					content: args.content,
					conversationId: args.conversationId,
					senderId: ctx.auth?.user?.id
				})
				.returning()
				.then((res) => res[0]);

			pubsub.publish(
				`userConversationMessages|${args.conversationId}`,
				{}
			);

			return message;
		}
	})
);

const handleParticipants = async (
	conversationId: string,
	participants: string[],
	action: 'add' | 'remove',
	ctx: Context
) => {
	const existingParticipants =
		await db.query.userConversationParticipant.findMany({
			where: (userConversationParticipant, { eq }) =>
				eq(userConversationParticipant.conversationId, conversationId)
		});

	const participantActions = participants.map(async (participant) => {
		const isParticipant = existingParticipants.some(
			(p) => p.userId === participant
		);
		if (action === 'add' && isParticipant)
			if (participants.length === 1)
				throwError(
					`User ${participant} is already in this conversation.`,
					'CONVERSATION_PARTICIPANT_ALREADY_EXISTS'
				);
			else {
				return null;
			}

		if (action === 'remove' && !isParticipant)
			if (participants.length === 1)
				throwError(
					`User ${participant} is not in this conversation.`,
					'CONVERSATION_PARTICIPANT_NOT_FOUND'
				);
			else {
				return null;
			}

		if (action === 'add') {
			const relationship = await db.query.userRelationship.findFirst({
				where: (userRelationship, { and, eq }) =>
					and(
						eq(userRelationship.fromId, participant),
						eq(userRelationship.toId, ctx.auth?.user?.id),
						eq(userRelationship.type, 'FOLLOW')
					)
			});

			if (!relationship)
				if (participants.length === 1)
					throwError(
						`You cannot add participants that do not follow you to a conversation.`,
						'CONVERSATION_FOLLOWING_PARTICIPANTS'
					);
				else {
					return null;
				}

			return db
				.insert(userConversationParticipant)
				.values({ conversationId, userId: participant })
				.returning()
				.then((res) => res[0]);
		} else {
			return db
				.delete(userConversationParticipant)
				.where(
					and(
						eq(
							userConversationParticipant.conversationId,
							conversationId
						),
						eq(userConversationParticipant.userId, participant)
					)
				)
				.returning()
				.then((res) => res[0]);
		}
	});

	const result = (await Promise.all(participantActions)).filter(
		(participant) => participant !== null
	) as {
		id: string;
		userId: string;
		conversationId: string;
		joinedAt: Date;
	}[];

	pubsub.publish(`userConversationParticipants|${conversationId}`, {});

	return result;
};

builder.mutationField('addUserConversationParticipants', (t) =>
	t.field({
		type: [UserConversationParticipant],
		args: {
			conversationId: t.arg.string({ required: true }),
			participants: t.arg.stringList({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await getConversation(args.conversationId);
			await getParticipant(ctx.auth?.user?.id, args.conversationId);

			if (conversation?.type === 'DIRECT')
				throwError(
					'You cannot add participants to a direct conversation.',
					'CONVERSATION_DIRECT_CANNOT_ADD_PARTICIPANTS'
				);

			await checkPermissions(
				['ADD_PARTICIPANTS'],
				args.conversationId,
				ctx.auth?.user?.id
			);

			return handleParticipants(
				args.conversationId,
				args.participants,
				'add',
				ctx
			);
		}
	})
);

builder.mutationField('removeUserConversationParticipants', (t) =>
	t.field({
		type: [UserConversationParticipant],
		args: {
			conversationId: t.arg.string({ required: true }),
			participants: t.arg.stringList({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await getConversation(args.conversationId);
			await getParticipant(ctx.auth?.user?.id, args.conversationId);

			if (conversation?.type === 'DIRECT')
				throwError(
					'You cannot remove participants from a direct conversation.',
					'CONVERSATION_DIRECT_CANNOT_REMOVE_PARTICIPANTS'
				);

			await checkPermissions(
				['REMOVE_PARTICIPANTS'],
				args.conversationId,
				ctx.auth?.user?.id
			);

			return handleParticipants(
				args.conversationId,
				args.participants,
				'remove',
				ctx
			);
		}
	})
);

const handleRoles = async (
	conversationId: string,
	name: string | null | undefined,
	description: string | null | undefined,
	defaultRole: boolean | null | undefined,
	permissions: string[] | null | undefined,
	action: 'create' | 'delete' | 'update',
	ctx: Context,
	id?: string
) => {
	const conversation = await getConversation(conversationId);
	await getParticipant(ctx.auth?.user?.id, conversationId);

	if (conversation?.type === 'DIRECT') {
		throwError(
			`You cannot manage roles in a direct conversation.`,
			'CONVERSATION_DIRECT_CANNOT_MANAGE_ROLES'
		);
	}

	await checkPermissions(
		action === 'create'
			? ['CREATE_ROLES']
			: action === 'delete'
				? ['DELETE_ROLES']
				: ['UPDATE_ROLES'],
		conversationId,
		ctx.auth?.user?.id
	);

	if (permissions) {
		for (const permission of permissions ?? []) {
			if (!validPermissions.includes(permission))
				throwError(
					`Permission ${permission} is not valid.`,
					'PERMISSION_NOT_VALID'
				);
		}
	}

	if (action === 'create' && name) {
		return db
			.insert(userConversationRole)
			.values({
				name,
				description,
				conversationId,
				default: defaultRole ?? false,
				permissions: JSON.stringify(permissions ?? [])
			})
			.returning()
			.then((res) => res[0]);
	} else if (action === 'delete' && id) {
		await db
			.delete(userConversationRole)
			.where(
				and(
					eq(userConversationRole.conversationId, conversationId),
					eq(userConversationRole.id, id!)
				)
			)
			.returning()
			.then((res) => res[0]);
	} else {
		const existingRole = await db.query.userConversationRole.findFirst({
			where: (userConversationRole, { and, eq }) =>
				and(
					eq(userConversationRole.conversationId, conversationId),
					eq(userConversationRole.id, id ?? '')
				)
		});

		if (!existingRole)
			return throwError(`Role ${id} does not exist.`, 'ROLE_NOT_FOUND');

		return db
			.update(userConversationRole)
			.set({
				name: name ?? existingRole.name,
				description: description ?? existingRole.description,
				default: defaultRole ?? existingRole.default,
				permissions:
					permissions !== null
						? JSON.stringify(permissions)
						: existingRole.permissions
			})
			.where(
				and(
					eq(userConversationRole.conversationId, conversationId),
					eq(userConversationRole.id, id ?? '')
				)
			)
			.returning()
			.then((res) => res[0]);
	}
};

builder.mutationField('createUserConversationRole', (t) =>
	t.field({
		type: UserConversationRole,
		args: {
			name: t.arg.string({ required: true }),
			description: t.arg.string(),
			conversationId: t.arg.string({ required: true }),
			default: t.arg.boolean({ defaultValue: false }),
			permissions: t.arg.stringList({ defaultValue: [''] })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			return handleRoles(
				args.conversationId,
				args.name,
				args.description,
				args.default,
				args.permissions,
				'create',
				ctx
			);
		}
	})
);

builder.mutationField('deleteUserConversationRole', (t) =>
	t.field({
		type: UserConversationRole,
		args: {
			id: t.arg.string({ required: true }),
			conversationId: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			return handleRoles(
				args.conversationId,
				null,
				null,
				null,
				null,
				'delete',
				ctx,
				args.id
			);
		}
	})
);

builder.mutationField('updateUserConversationRole', (t) =>
	t.field({
		type: UserConversationRole,
		args: {
			id: t.arg.string({ required: true }),
			conversationId: t.arg.string({ required: true }),
			name: t.arg.string(),
			description: t.arg.string(),
			default: t.arg.boolean(),
			permissions: t.arg.stringList()
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			return handleRoles(
				args.conversationId,
				args.name,
				args.description,
				args.default,
				args.permissions,
				'update',
				ctx,
				args.id
			);
		}
	})
);

const handleParticipantRoles = async (
	conversationId: string,
	roles: string[],
	participants: string[],
	action: 'create' | 'delete',
	ctx: Context
) => {
	const conversation = await getConversation(conversationId);
	await getParticipant(ctx.auth?.user?.id, conversationId);

	if (conversation?.type === 'DIRECT') {
		throwError(
			`You cannot manage roles in a direct conversation.`,
			'CONVERSATION_DIRECT_CANNOT_MANAGE_ROLES'
		);
	}

	await checkPermissions(
		['MANAGE_ROLES'],
		conversationId,
		ctx.auth?.user?.id
	);

	const results: { participantId: string; roleId: string }[] = [];
	for (const participant of participants) {
		for (const role of roles) {
			const existingRole =
				await db.query.userConversationParticipantRole.findFirst({
					where: (userConversationParticipantRole, { and, eq }) =>
						and(
							eq(userConversationParticipantRole.roleId, role),
							eq(
								userConversationParticipantRole.participantId,
								participant
							)
						)
				});

			if (action === 'create') {
				if (existingRole)
					throwError(
						`Role ${role} is already assigned to ${participant}.`,
						'ROLE_ALREADY_ASSIGNED'
					);

				const newRole = await db
					.insert(userConversationParticipantRole)
					.values({ participantId: participant, roleId: role })
					.returning()
					.then((res) => res[0]);

				if (newRole) {
					results.push(newRole);
				}
			} else {
				if (!existingRole)
					throwError(
						`Role ${role} is not assigned to ${participant}.`,
						'ROLE_NOT_ASSIGNED'
					);

				const deletedRole = await db
					.delete(userConversationParticipantRole)
					.where(
						and(
							eq(userConversationParticipantRole.roleId, role),
							eq(
								userConversationParticipantRole.participantId,
								participant
							)
						)
					)
					.returning()
					.then((res) => res[0]);

				if (deletedRole) {
					results.push(deletedRole);
				}
			}
		}
	}
	return results;
};

builder.mutationField('createUserConversationParticipantRoles', (t) =>
	t.field({
		type: [UserConversationParticipantRole],
		args: {
			conversationId: t.arg.string({ required: true }),
			roles: t.arg.stringList({ required: true }),
			participants: t.arg.stringList({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			return handleParticipantRoles(
				args.conversationId,
				args.roles,
				args.participants,
				'create',
				ctx
			);
		}
	})
);

builder.mutationField('deleteUserConversationParticipantRoles', (t) =>
	t.field({
		type: [UserConversationParticipantRole],
		args: {
			conversationId: t.arg.string({ required: true }),
			roles: t.arg.stringList({ required: true }),
			participants: t.arg.stringList({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			return handleParticipantRoles(
				args.conversationId,
				args.roles,
				args.participants,
				'delete',
				ctx
			);
		}
	})
);
