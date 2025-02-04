import { GraphQLError } from 'graphql';

const throwError = (message: string, code: string) => {
	throw new GraphQLError(message, { extensions: { code } });
};

const throwFeatureDisabledError = () => {
	throw new GraphQLError(
		'This feature has been disabled by the instance owner.',
		{ extensions: { code: 'FEATURE_DISABLED' } }
	);
};

export { throwError, throwFeatureDisabledError };
