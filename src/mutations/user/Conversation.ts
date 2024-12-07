import { Context } from '../../context';
import { builder } from '../../builder';
import { db } from '../../drizzle/db';
import {
	userConversation,
	userConversationMessage,
	userConversationParticipant
} from '../../drizzle/schema';
import { UserConversationMessage } from '../../types/user/conversation/Message';
import { pubsub } from '../../pubsub';
import { GraphQLError } from 'graphql';
import { UserConversation, UserConversationType } from '../../types';

builder.mutationField('createConversation', (t) =>
	t.field({
		type: UserConversation,
		args: {
			name: t.arg.string({ required: false }),
			type: t.arg({ type: UserConversationType, required: true }),
			participants: t.arg.stringList({ required: true })
		},
		resolve: async (_root, args, ctx: Context) => {
			// Ensure that the current user is included in the participants list.
			const _participants = args.participants.map((id) => id.toString());

			if (!_participants.includes(ctx.oidc.sub)) {
				_participants.push(ctx.oidc.sub);
			}

			if (_participants.length < 2) {
				throw new GraphQLError(
					'A conversation must have at least 2 participants.',
					{
						extensions: {
							code: 'CONVERSATION_MIN_PARTICIPANTS'
						}
					}
				);
			}

			if (args.type === 'DIRECT') {
				if (_participants.length > 2) {
					throw new GraphQLError(
						'A direct conversation can only have 2 participants.',
						{
							extensions: {
								code: 'CONVERSATION_DIRECT_MAX_PARTICIPANTS'
							}
						}
					);
				} else {
					const directConversations =
						await db.query.userConversation.findMany({
							where: (userConversation, { eq }) =>
								eq(userConversation.type, 'DIRECT'),
							with: {
								participants: {
									columns: {
										userId: true
									}
								}
							}
						});

					const existingConversation = directConversations.find(
						(conversation) =>
							conversation.participants.every((participant) =>
								_participants.includes(participant.userId)
							)
					);

					if (existingConversation) {
						throw new GraphQLError(
							'You are already in a direct conversation with one of the other participants.',
							{
								extensions: {
									code: 'CONVERSATION_ALREADY_IN_DIRECT'
								}
							}
						);
					}
				}
			}

			const conversation = await db
				.insert(userConversation)
				.values({
					name: args.type === 'DIRECT' ? null : args.name,
					type: args.type
				})
				.returning()
				.then((res) => res[0]);

			await db.insert(userConversationParticipant).values(
				_participants.map((userId) => ({
					conversationId: conversation.id,
					userId: userId
				}))
			);

			return db.query.userConversation.findFirst({
				where: (userConversation, { eq }) =>
					eq(userConversation.id, conversation.id)
			});
		}
	})
);

builder.mutationField('createConversationMessage', (t) =>
	t.field({
		type: UserConversationMessage,
		args: {
			content: t.arg.string({ required: true }),
			conversationId: t.arg.string({ required: true })
		},
		resolve: async (_root, _args, ctx: Context) => {
			const conversation = await db.query.userConversation.findFirst({
				where: (userConversation, { eq }) =>
					eq(userConversation.id, _args.conversationId)
			});

			if (!conversation) {
				throw new GraphQLError('The conversation does not exist.', {
					extensions: {
						code: 'CONVERSATION_NOT_FOUND'
					}
				});
			}

			const participant =
				await db.query.userConversationParticipant.findFirst({
					where: (userConversationParticipant, { eq }) =>
						eq(userConversationParticipant.userId, ctx.oidc.sub)
				});

			if (!participant) {
				throw new GraphQLError(
					'You must be a participant in this conversation to send a message.',
					{
						extensions: {
							code: 'CONVERSATION_PARTICIPANT_REQUIRED'
						}
					}
				);
			}

			const message = await db
				.insert(userConversationMessage)
				.values({
					content: _args.content,
					conversationId: _args.conversationId,
					senderId: ctx.oidc.sub
				})
				.returning()
				.then((res) => res[0]);

			pubsub.publish(
				`userConversationMessages${_args.conversationId}`,
				{}
			);

			return message;
		}
	})
);
