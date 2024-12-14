/**
 * This file contains long functions that we would rather not have to scroll through.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import mime from 'mime-types';
import { config } from '../config';
import { db } from '../drizzle/db';
import { postMedia, user } from '../drizzle/schema';
import { syncClient, tokenClient } from '../redis';
import { authorize } from './authentication';
import { convertModelToUser, getHashedPk, internalUsers } from './authentik';
import { mockClient } from 'aws-sdk-client-mock';

/**
 * "Legacy" endpoint for uploading media.
 * @param req The request object containing the file to upload and authentication headers.
 * @returns A JSON response with a status and message.
 */
async function mediaUploadEndpoint(req: Request) {
	// Get the token from the request headers.
	const token = req.headers.get('Authorization')?.split(' ')[1];

	// If the token is not present, return an error.
	if (!token) {
		return Response.json(
			{
				status: 'MISSING_TOKEN',
				message: 'This endpoint requires authentication.'
			},
			{ status: 401 }
		);
	}

	// Check if the token is valid.
	const check = await authorize(config.openid, token);

	try {
		JSON.parse(check!);
	} catch (e) {
		return Response.json(
			{
				status: 'INVALID_TOKEN',
				message: check
			},
			{ status: 401 }
		);
	}

	const formdata = await req.formData();
	const media = formdata.get('media') as File;
	if (!media) {
		return Response.json(
			{
				status: 'FILE_MISSING',
				message: 'Must upload a media file.'
			},
			{ status: 400 }
		);
	}

	// Generate a random UUID for the media.
	const possibleUUID = crypto.randomUUID();

	// Define allowed MIME types
	const allowedMimeTypes = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'video/mp4',
		'video/webm',
		'video/ogg'
	];

	// Check if the media's MIME type is allowed
	if (!allowedMimeTypes.includes(media.type)) {
		return Response.json(
			{
				status: 'UNSUPPORTED_MEDIA_TYPE',
				message:
					'Unsupported media type. Allowed types are JPEG, PNG, GIF, WebP, MP4, WebM, and Ogg.'
			},
			{ status: 400 }
		);
	}

	const sizeLimits = {
		'image/gif': 15728640,
		'image/apng': 15728640,
		'video/mp4': 104857600,
		'video/webm': 104857600,
		'video/ogg': 104857600,
		default: 5242880
	};

	const maxSize =
		sizeLimits[media.type as keyof typeof sizeLimits] ??
		sizeLimits['default'];

	if (media.size > maxSize) {
		return Response.json(
			{
				status: 'FILE_SIZE_EXCEEDED',
				message: `File size must be less than ${
					maxSize / 1048576
				} MB for ${media.type.split('/')[0]}s.`
			},
			{ status: 413 }
		);
	}

	// Generate a predicted key for the S3 upload.
	const s3PredictedKey = `${
		Bun.env.S3_UPLOAD_DIR
	}/${possibleUUID}.${mime.extension(media.type)}`;

	try {
		const _client = new S3Client({
			credentials: {
				accessKeyId: Bun.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: Bun.env.AWS_SECRET_ACCESS_KEY!
			},
			region: Bun.env.S3_REGION! ?? 'us-east-1',
			endpoint:
				Bun.env.AWS_ENDPOINT! ?? 'https://s3.us-east-1.amazonaws.com'
		});

		isTestMode && mockClient(_client);

		const upload = new Upload({
			client: _client,
			params: {
				ACL: 'public-read',
				Bucket: Bun.env.S3_BUCKET!,
				Key: s3PredictedKey,
				Body: media
			}
		});

		const s3Upload = await upload.done();
		console.log('S3 upload success:', s3Upload.Location);

		// Insert the media into the database.
		const dbMedia = await db
			.insert(postMedia)
			.values({
				id: possibleUUID,
				url: `/${s3PredictedKey}`
			})
			.returning()
			.execute();

		// TODO: Add a queue for 5 minutes to delete if not used.

		return Response.json({
			status: 'QUEUED',
			message: 'Media queued for upload.',
			id: dbMedia[0].id
		});
	} catch (error) {
		console.error('S3 upload error:', error);
		return Response.json(
			{
				status: 'UPLOAD_FAILED',
				message: 'Failed to upload media.'
			},
			{ status: 500 }
		);
	}
}

/**
 *
 * Endpoint for webhooks. Authentik is the only one used for authentication right now.
 * @param req The request object containing the webhook data.
 * @returns A JSON response with a status and message.
 */
async function webhookEndpoint(req: Request) {
	const url = new URL(req.url);
	console.log(url.pathname, isTestMode);
	switch (url.pathname) {
		case `/webhook/${isTestMode ? 'TEST-AUTH' : Bun.env.WEBHOOK_AUTH}`:
			if (
				isTestMode ||
				(Bun.env.AUTH_INTROSPECT_URL?.endsWith(
					'/application/o/introspect/'
				) &&
					isTestMode) ||
				Bun.env.AUTH_USERINFO_URL?.endsWith('/application/o/userinfo/')
			) {
				// Convert the request body to JSON and sort it.
				var json = await req.json();
				var model = convertModelToUser(json);

				// Assign the model data to variables.
				const {
					username = model?.data.username! ??
						model?.data.diff?.username?.new_value!,
					displayName = model?.data.name! ??
						model?.data.diff?.name?.new_value!,
					avatar = model?.data.attributes?.avatar! ??
						model?.data.diff?.attributes?.new_value?.avatar!,
					banner = model?.data.attributes?.banner! ??
						model?.data.diff?.attributes?.new_value?.banner!,
					background = model?.data.attributes?.background! ??
						model?.data.diff?.attributes?.new_value?.background!,
					email = model?.data.email! ??
						model?.data.diff?.email?.new_value!
				} = model?.data;

				// Skip out on internal users.
				if (new RegExp(internalUsers.join('|')).test(username)) {
					return new Response(
						'Nope, internal users are not allowed.',
						{ status: 200 }
					);
				}

				// Convert the ID to a hashed version.
				const id = getHashedPk(model?.data?.model?.pk);

				// Check if the user exists in the database
				const userInDb = await db.query.user.findFirst({
					where: (user, { eq }) => eq(user.id, id)
				});

				// Insert (or Update) the user in to the database.
				await db
					.insert(user)
					.values({
						id,
						username,
						displayName,
						avatar,
						banner,
						background,
						email
					})
					.onConflictDoUpdate({
						target: user.id,
						set: {
							id,
							username,
							displayName,
							avatar,
							banner,
							background,
							email
						}
					});

				// If the user does not exist, tell the console that we are creating data for the user
				if (!userInDb) {
					console.log(
						`💾 Creating data for user: ${username ?? email ?? id}`
					);
				} else {
					console.log(
						`🔄 Syncing data for user: ${username ?? email ?? id}`
					);
				}

				return Response.json({}, { status: 200 });
			}

			// If the user isn't using authentik, return a 404.
			return Response.json(
				{
					status: 'WORK_IN_PROGRESS',
					message: 'This webhook is not implemented yet'
				},
				{ status: 404 }
			);
		case `/webhook/${isTestMode ? 'TEST-STRIPE' : Bun.env.WEBHOOK_STRIPE}`:
			return Response.json(
				{
					status: 'WORK_IN_PROGRESS',
					message: 'This webhook is not implemented yet'
				},
				{ status: 404 }
			);
		default:
			return Response.json(
				{
					status: 'NOT_FOUND',
					message: 'Invalid webhook endpoint'
				},
				{ status: 404 }
			);
	}
}

/**
 * Grabs the token from Redis and converts it to JSON,
 * which is then used to update or add new users to the
 * database.
 */
async function createUsersFromRedisTokens() {
	// Ensure that sync client can listen to events.
	// This is used to check for new tokens inserted into cache.
	syncClient.configSet('notify-keyspace-events', 'KEA');

	// Subscribe to the tokens channel.
	await syncClient.pSubscribe(
		'__keyspace@0__:tokens:*',
		async (message, channel) => {
			// Discard if the message is not 'set'.
			if (message != 'set') {
				return;
			}

			// Extract the token from the channel.
			const token = channel.split('__:')[1];
			// Parse the token from Redis using JSON.
			const content = JSON.parse((await tokenClient.get(token)) || '{}');

			// Discard if no username is present
			if (!content?.preferred_username) {
				return;
			}

			// Check if the user exists in the database
			const userInDb = await db.query.user.findFirst({
				where: (user, { eq }) => eq(user.id, content?.sub)
			});

			// If the user does not exist, tell the console that we are creating data for the user
			if (!userInDb) {
				console.log(
					`💾 Creating data for user: ${content?.preferred_username}`
				);
			} else {
				console.log(
					`🔄 Syncing data for user: ${content?.preferred_username}`
				);
			}

			// Insert (or Update) the user in to the database.
			try {
				await db
					.insert(user)
					.values({
						id: content?.sub!,
						username: content?.preferred_username!,
						displayName: content?.name!,
						avatar: content?.avatar!,
						banner: content?.banner!,
						background: content?.background!,
						email: content?.email!,
						createdAt: new Date()
					})
					.onConflictDoUpdate({
						target: user.id,
						set: {
							id: content?.sub!,
							username: content?.preferred_username!,
							displayName: content?.name!,
							avatar: content?.avatar!,
							banner: content?.banner!,
							background: content?.background!,
							email: content?.email!
						}
					});
			} catch (ex) {
				// Log the error.
				console.error(ex);
			}
		}
	);
}

// Just a shortcut for checking if we are in test mode.
const isTestMode = Bun.env.NODE_ENV === 'test';

export {
	createUsersFromRedisTokens,
	mediaUploadEndpoint,
	webhookEndpoint,
	isTestMode
};
