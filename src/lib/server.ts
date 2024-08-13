/**
 * This file contains long functions that we would rather not have to scroll through.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { db } from '../drizzle/db';
import { postMedia, user } from '../drizzle/schema';
import { authorize } from './authentication';
import { syncClient, tokenClient } from '../redis';
import { Config } from '../config';
import mime from 'mime-types';

/**
 * "Legacy" endpoint for uploading media.
 * @param req The request object containing the file to upload and authentication headers.
 * @returns A JSON response with a status and message.
 */
async function mediaUploadEndpoint(req: Request) {
	// Get the token from the request headers.
	const token = req.headers.get('Authorization')?.split(' ')[1]!;

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
	const check = await authorize(Config.OpenID, token);

	// If the token is invalid, return an error.
	if (check)
		return Response.json(
			{
				status: 'INVALID_TOKEN',
				message: check
			},
			{ status: 401 }
		);

	const formdata = await req.formData();
	const media = formdata.get('media') as File;
	if (!media)
		return Response.json(
			{
				status: 'FILE_MISSING',
				message: 'Must upload a media file.'
			},
			{ status: 400 }
		);

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

	if (media.type === 'image/gif' || media.type === 'image/apng') {
		if (media.size > 15728640) {
			// File size must be less than 15 MB
			return Response.json(
				{
					status: 'FILE_SIZE_EXCEEDED',
					message: 'File size must be less than 15 MB for GIFs.'
				},
				{ status: 413 }
			);
		}
	} else if (media.type.includes('video/')) {
		// File size must be less than 100 MB
		if (media.size > 104857600) {
			return Response.json(
				{
					status: 'FILE_SIZE_EXCEEDED',
					message: 'File size must be less than 100 MB for videos.'
				},
				{ status: 413 }
			);
		}
	} else if (media.size > 5242880) {
		// File size must be less than 5 MB
		return Response.json(
			{
				status: 'FILE_SIZE_EXCEEDED',
				message: 'File size must be less than 5 MB for images.'
			},
			{ status: 413 }
		);
	}

	// Generate a predicted key for the S3 upload.
	const s3PredictedKey =
		process.env.S3_UPLOAD_DIR! +
		'/' +
		possibleUUID +
		'.' +
		mime.extension(media.type);

	new Upload({
		client: new S3Client({
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
			},
			region: process.env.S3_REGION!,
			endpoint: process.env.AWS_ENDPOINT!
		}),
		params: {
			ACL: 'public-read',
			Bucket: process.env.S3_BUCKET!,
			Key: s3PredictedKey,
			Body: media
		}
	})
		.done()
		.then((s3Upload) => {
			console.log('S3 upload success:', s3Upload.Location);
		});

	// Insert the media into the database.
	const dbMedia = await db
		.insert(postMedia)
		.values({
			id: possibleUUID,
			url: '/' + s3PredictedKey
		})
		.returning()
		.execute();

	// TODO: Add a queue for 5 minutes to delete if not used.

	return Response.json({
		status: 'QUEUED',
		message: 'Media queued for upload.',
		id: dbMedia[0].id
	});
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

export { mediaUploadEndpoint, createUsersFromRedisTokens };
