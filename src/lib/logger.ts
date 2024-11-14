import debug from 'debug';

export const log = debug('app:log');
export const guardianLog = debug('lib:guardian');
export const authentikLog = debug('lib:authentik');
export const error = debug('app:error');

// Enables all debug namespaces
export function enableAll() {
	return debug.enable('app:log,lib:guardian,lib:authentik,app:error');
}
