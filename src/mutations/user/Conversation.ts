import { and, eq } from 'drizzle-orm';
import { builder } from '../../builder';
import { Context } from '../../context';
import { db } from '../../drizzle/db';
import {
	userConversation,
	userConversationMessage,
	userConversationParticipant
} from '../../drizzle/schema';
import { throwError } from '../../helpers/common';
import {
	checkPermissions,
	getConversation,
	getParticipant
} from '../../helpers/user/Conversation';
import { pubsub } from '../../pubsub';
import { UserConversation, UserConversationType } from '../../types';
import { UserConversationMessage } from '../../types/user/conversation/Message';
import { UserConversationParticipant } from '../../types/user/conversation/Participant';

const validateParticipants = (
	participants: string[],
	currentUserId: string
) => {
	if (!participants.includes(currentUserId)) participants.push(currentUserId);
	if (participants.length < 2) {
		return throwError(
			'A conversation must have at least 2 participants.',
			'CONVERSATION_MIN_PARTICIPANTS'
		);
	}
};

const checkDirectConversation = async (participants: string[]) => {
	if (participants.length > 2) {
		return throwError(
			'A direct conversation can only have 2 participants.',
			'CONVERSATION_DIRECT_MAX_PARTICIPANTS'
		);
	}
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
	if (existingConversation) {
		return throwError(
			'You are already in a direct conversation with one of the other participants.',
			'CONVERSATION_ALREADY_IN_DIRECT'
		);
	}
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

const handleParticipants = async (
	conversationId: string,
	participants: string[],
	action: 'add' | 'remove'
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
		if (action === 'add' && isParticipant) {
			return throwError(
				`User ${participant} is already in this conversation.`,
				'CONVERSATION_PARTICIPANT_ALREADY_EXISTS'
			);
		} else if (action === 'remove' && !isParticipant) {
			return throwError(
				`User ${participant} is not in this conversation.`,
				'CONVERSATION_PARTICIPANT_NOT_FOUND'
			);
		}

		if (action === 'add') {
			return db
				.insert(userConversationParticipant)
				.values({
					conversationId,
					userId: participant
				})
				.returning()
				.then((res) => res[0]);
		} else {
			await db
				.delete(userConversationParticipant)
				.where(
					and(
						eq(
							userConversationParticipant.conversationId,
							conversationId
						),
						eq(userConversationParticipant.userId, participant)
					)
				);
			return null;
		}
	});

	return (await Promise.all(participantActions)).filter(
		(participant) => participant !== null
	) as {
		id: string;
		userId: string;
		conversationId: string;
		joinedAt: Date;
	}[];
};

builder.mutationField('createUserConversation', (t) =>
	t.field({
		type: UserConversation,
		args: {
			name: t.arg.string({ required: false }),
			type: t.arg({ type: UserConversationType, required: true }),
			participants: t.arg.stringList({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			const participants = args.participants.map((id) => id.toString());
			validateParticipants(participants, ctx.oidc.sub);

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
		resolve: async (_root, args, ctx: Context) => {
			await checkPermissions(
				['SEND_MESSAGES'],
				args.conversationId,
				ctx.oidc.sub
			);

			const message = await db
				.insert(userConversationMessage)
				.values({
					content: args.content,
					conversationId: args.conversationId,
					senderId: ctx.oidc.sub
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

builder.mutationField('addUserConversationParticipants', (t) =>
	t.field({
		type: [UserConversationParticipant],
		args: {
			conversationId: t.arg.string({ required: true }),
			participants: t.arg.stringList({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await getConversation(args.conversationId);
			await getParticipant(ctx.oidc.sub, args.conversationId);

			if (conversation?.type === 'DIRECT') {
				return throwError(
					'You cannot add participants to a direct conversation.',
					'CONVERSATION_DIRECT_CANNOT_ADD_PARTICIPANTS'
				);
			}

			await checkPermissions(
				['ADD_PARTICIPANTS'],
				args.conversationId,
				ctx.oidc.sub
			);

			return handleParticipants(
				args.conversationId,
				args.participants,
				'add'
			);
		}
	})
);

builder.mutationField('removeUserConversationParticipants', (t) =>
	t.field({
		type: 'Boolean',
		args: {
			conversationId: t.arg.string({ required: true }),
			participants: t.arg.stringList({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			const conversation = await getConversation(args.conversationId);
			await getParticipant(ctx.oidc.sub, args.conversationId);

			if (conversation?.type === 'DIRECT') {
				return throwError(
					'You cannot remove participants from a direct conversation.',
					'CONVERSATION_DIRECT_CANNOT_REMOVE_PARTICIPANTS'
				);
			}

			await checkPermissions(
				['REMOVE_PARTICIPANTS'],
				args.conversationId,
				ctx.oidc.sub
			);

			await handleParticipants(
				args.conversationId,
				args.participants,
				'remove'
			);

			return true;
		}
	})
);
