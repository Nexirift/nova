import { createHash } from 'crypto';

export const internalUsers = ['akadmin', '^ak-outpost-[a-f0-9]{32}$'];

/**
 * This function converts the JSON object returned by Authentik to a more usable object.
 * @param jsonObject The JSON object to convert.
 * @returns A more usable (parsed and fixed) object.
 */
export function convertModelToUser(jsonObject: any) {
	// Replace some common values
	var modelData = jsonObject.body;
	modelData = modelData.replace(/True/g, 'true');
	modelData = modelData.replace(/False/g, 'false');
	modelData = modelData.replace(/None/g, '""');
	modelData = modelData.replace(/'/g, '"');

	var firstSpace = modelData.indexOf(' ');
	let type;

	// Get and strip the type from the model data
	if (firstSpace > 0) {
		type = modelData.substring(0, firstSpace).replace(':', '');
		modelData = modelData.substring(firstSpace);
	}

	// Parse the model data as JSON
	return {
		type: type,
		data: JSON.parse(modelData)
	};
}

/**
 * This function converts a user ID from the database to a hashed version.
 * @param pk The user ID from the database.
 * @returns A hashed version of the user ID.
 */
export function getHashedPk(pk: string) {
	const hashedPk = createHash('sha256')
		.update(pk + '-' + process.env.AUTH_INSTALLATION_ID)
		.digest('hex');
	return hashedPk;
}
