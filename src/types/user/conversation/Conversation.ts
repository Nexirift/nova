import { User } from '../..';
import { builder } from '../../../builder';
import { db } from '../../../drizzle/db';
import { type UserConversationSchemaType } from '../../../drizzle/schema';
import { UserConversationParticipant } from './Participant';

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
		participants: t.field({
			type: [UserConversationParticipant],
			nullable: false,
			args: {
				first: t.arg({ type: 'Int' }),
				offset: t.arg({ type: 'Int' })
			},
			resolve: async (parent, args) => {
				const result =
					await db.query.userConversationParticipant.findMany({
						where: (userConversationParticipant, { eq }) =>
							eq(
								userConversationParticipant.conversationId,
								parent.id
							),
						limit: args.first!,
						offset: args.offset!,
						with: {
							user: true
						}
					});
				return result!;
			}
		}),
		createdAt: t.expose('createdAt', { type: 'Date', nullable: false })
	})
});
