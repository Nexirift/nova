import type { UserRelationshipSchemaType } from '@nexirift/db';
import { db, userRelationship } from '@nexirift/db';
import { and, eq, or } from 'drizzle-orm';
import { builder } from '../../builder';
import type { Context } from '../../context';
import { throwError } from '../../helpers/common';
import { UserRelationship } from '../../types';

// Define the possible relationship types
const relationshipTypes = [
	'BLOCK',
	'UNBLOCK',
	'MUTE',
	'UNMUTE',
	'FOLLOW',
	'UNFOLLOW'
] as const;

// Create mutation fields for each relationship type
relationshipTypes.forEach((type) => {
	builder.mutationField(`${type.toLowerCase()}User`, (t) =>
		t.field({
			type: UserRelationship,
			args: {
				id: t.arg.string({ required: true }),
				reason: t.arg.string()
			},
			authScopes: { loggedIn: true },
			resolve: async (_root, args, ctx: Context) =>
				modifyRelationship(ctx, args, type)
		})
	);
});

builder.mutationField('acceptFollowRequest', (t) =>
	t.field({
		type: UserRelationship,
		args: {
			id: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			const requestedRelationship =
				await db.query.userRelationship.findFirst({
					where: (userRelationship, { and }) =>
						and(
							eq(userRelationship.fromId, args.id),
							eq(userRelationship.toId, ctx.auth?.user?.id),
							eq(userRelationship.type, 'REQUEST')
						)
				});

			if (!requestedRelationship) {
				return throwError(
					'This user does not exist or has not sent a follow request.',
					'FOLLOW_REQUEST_NOT_FOUND'
				);
			}

			return db
				.update(userRelationship)
				.set({ type: 'FOLLOW' })
				.where(
					and(
						eq(userRelationship.fromId, args.id),
						eq(userRelationship.toId, ctx.auth?.user?.id),
						eq(userRelationship.type, 'REQUEST')
					)
				)
				.returning()
				.then((res) => res[0]);
		}
	})
);

builder.mutationField('denyFollowRequest', (t) =>
	t.field({
		type: 'Boolean',
		args: {
			id: t.arg.string({ required: true })
		},
		authScopes: { loggedIn: true },
		resolve: async (_root, args, ctx: Context) => {
			const requestedRelationship =
				await db.query.userRelationship.findFirst({
					where: (userRelationship, { and }) =>
						and(
							eq(userRelationship.fromId, args.id),
							eq(userRelationship.toId, ctx.auth?.user?.id),
							eq(userRelationship.type, 'REQUEST')
						)
				});

			if (!requestedRelationship) {
				return throwError(
					'This user does not exist or has not sent a follow request.',
					'FOLLOW_REQUEST_NOT_FOUND'
				);
			}

			await db
				.delete(userRelationship)
				.where(
					and(
						eq(userRelationship.fromId, args.id),
						eq(userRelationship.toId, ctx.auth?.user?.id),
						eq(userRelationship.type, 'REQUEST')
					)
				)
				.returning()
				.then((res) => res[0]);

			return true;
		}
	})
);

// Function to modify user relationships
async function modifyRelationship(
	ctx: Context,
	args: { id: string; reason?: string | null },
	type: 'BLOCK' | 'UNBLOCK' | 'MUTE' | 'UNMUTE' | 'FOLLOW' | 'UNFOLLOW'
): Promise<UserRelationshipSchemaType | null> {
	// Prevent users from performing actions on themselves
	if (ctx.auth?.user?.id === args.id) {
		return throwError(
			`You cannot ${type.toLowerCase()} yourself.`,
			`CANNOT_${type.toUpperCase()}_SELF`
		);
	}

	// Check if the requested user exists
	const requestedUser = await db.query.user.findFirst({
		where: (user, { eq }) => eq(user.id, args.id)
	});

	if (!requestedUser) {
		return throwError('User not found.', 'USER_NOT_FOUND');
	}

	// Map relationship types to their corresponding database values
	const relationshipMap = {
		BLOCK: 'BLOCK',
		UNBLOCK: 'BLOCK',
		MUTE: 'MUTE',
		UNMUTE: 'MUTE',
		FOLLOW: 'FOLLOW',
		UNFOLLOW: 'FOLLOW'
	};

	// Map error messages for each relationship type
	const errorMap = {
		BLOCK: 'You have already blocked this user.',
		UNBLOCK: 'You are not currently blocking this user.',
		MUTE: 'You have already muted this user.',
		UNMUTE: 'You are not currently muting this user.',
		FOLLOW: 'You have already followed this user or a request has already been sent.',
		UNFOLLOW:
			'You are not currently following this user or have not sent a follow request.'
	};

	const requestedType = relationshipMap[type];

	// Check if the relationship already exists
	const requestedRelationship = await db.query.userRelationship.findFirst({
		where: (userRelationship, { and }) =>
			and(
				eq(userRelationship.fromId, ctx.auth?.user?.id),
				eq(userRelationship.toId, args.id),
				eq(
					userRelationship.type,
					requestedType as 'BLOCK' | 'MUTE' | 'FOLLOW' | 'REQUEST'
				)
			)
	});

	// Helper function to check for existing relationships
	async function hasExistingRelationship(
		ctx: Context,
		args: { id: string },
		type: 'BLOCK' | 'UNBLOCK' | 'MUTE' | 'UNMUTE' | 'FOLLOW' | 'UNFOLLOW'
	) {
		const requestedType = relationshipMap[type];
		return db.query.userRelationship.findFirst({
			where: (userRelationship, { and }) =>
				and(
					eq(userRelationship.fromId, ctx.auth?.user?.id),
					eq(userRelationship.toId, args.id),
					eq(
						userRelationship.type,
						requestedType as 'BLOCK' | 'MUTE' | 'FOLLOW' | 'REQUEST'
					)
				)
		});
	}

	// Helper function to throw errors for non-actioned users
	async function throwUserNotActionedError(
		type: 'BLOCK' | 'UNBLOCK' | 'MUTE' | 'UNMUTE' | 'FOLLOW' | 'UNFOLLOW'
	) {
		return throwError(errorMap[type], `USER_NOT_${type}ED`);
	}

	// Handle BLOCK, MUTE, and FOLLOW actions
	if (['BLOCK', 'MUTE', 'FOLLOW'].includes(type)) {
		const existingRelationship = await hasExistingRelationship(
			ctx,
			args,
			type
		);
		if (existingRelationship) {
			return throwError(errorMap[type], `USER_ALREADY_${type}ED`);
		}

		// Handle follow requests for private users
		if (type === 'FOLLOW' && requestedUser.type === 'PRIVATE') {
			const followRequest = await db.query.userRelationship.findFirst({
				where: (userRelationship, { and }) =>
					and(
						eq(userRelationship.fromId, ctx.auth?.user?.id),
						eq(userRelationship.toId, args.id),
						eq(userRelationship.type, 'REQUEST')
					)
			});

			if (followRequest) {
				return throwError(errorMap[type], `USER_ALREADY_${type}ED`);
			}
			return db
				.insert(userRelationship)
				.values({
					fromId: ctx.auth?.user?.id,
					toId: args.id,
					type: 'REQUEST',
					reason: args.reason
				})
				.returning()
				.then((res) => res[0] || null);
		}

		// Handle blocking users
		if (type === 'BLOCK') {
			await db
				.delete(userRelationship)
				.where(
					and(
						or(
							and(
								eq(userRelationship.fromId, ctx.auth?.user?.id),
								eq(userRelationship.toId, args.id)
							),
							and(
								eq(userRelationship.fromId, args.id),
								eq(userRelationship.toId, ctx.auth?.user?.id)
							)
						),
						or(
							eq(userRelationship.type, 'REQUEST'),
							eq(userRelationship.type, 'FOLLOW')
						)
					)
				)
				.execute();
		}

		// Insert new relationship
		return db
			.insert(userRelationship)
			.values({
				fromId: ctx.auth?.user?.id,
				toId: args.id,
				type: type as 'BLOCK' | 'MUTE' | 'FOLLOW' | 'REQUEST',
				reason: args.reason
			})
			.returning()
			.then((res) => res[0] || null);
	} else {
		// Handle UNBLOCK, UNMUTE, and UNFOLLOW actions
		if (!requestedRelationship) {
			const followRequest = await db.query.userRelationship.findFirst({
				where: (userRelationship, { and }) =>
					and(
						eq(userRelationship.fromId, ctx.auth?.user?.id),
						eq(userRelationship.toId, args.id),
						eq(userRelationship.type, 'REQUEST')
					)
			});

			if (!followRequest) {
				throw await throwUserNotActionedError(type);
			}

			return db
				.delete(userRelationship)
				.where(
					and(
						eq(userRelationship.fromId, ctx.auth?.user?.id),
						eq(userRelationship.toId, args.id),
						eq(userRelationship.type, 'REQUEST')
					)
				)
				.returning()
				.then((res) => res[0] || null);
		}

		// Delete existing relationship
		return db
			.delete(userRelationship)
			.where(
				and(
					eq(userRelationship.fromId, ctx.auth?.user?.id),
					eq(userRelationship.toId, args.id)
				)
			)
			.returning()
			.then((res) => res[0] || null);
	}
}
