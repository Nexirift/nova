/**
 * This file contains long functions that we would rather not have to scroll through.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { db, postMedia } from '@nexirift/db';
import { authorize } from '@nexirift/plugin-better-auth';
import { mockClient } from 'aws-sdk-client-mock';
import mime from 'mime-types';
import { config } from '../config';
import { env } from '../env';

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
	await authorize(config.auth, token);

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
		env.S3_UPLOAD_DIR
	}/${possibleUUID}.${mime.extension(media.type)}`;

	try {
		const _client = new S3Client({
			credentials: {
				accessKeyId: env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: env.AWS_SECRET_ACCESS_KEY!
			},
			region: env.S3_REGION! ?? 'us-east-1',
			endpoint: env.AWS_ENDPOINT! ?? 'https://s3.us-east-1.amazonaws.com'
		});

		if (isTestMode) {
			mockClient(_client);
		}

		const upload = new Upload({
			client: _client,
			params: {
				ACL: 'public-read',
				Bucket: env.S3_BUCKET!,
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
			id: dbMedia[0]?.id
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

// Just a shortcut for checking if we are in test mode.
const isTestMode = env.NODE_ENV === 'test';

export { isTestMode, mediaUploadEndpoint };
