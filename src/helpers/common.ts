import { GraphQLError } from 'graphql';

const throwError = (message: string, code: string) => {
	throw new GraphQLError(message, { extensions: { code } });
};

export { throwError };
