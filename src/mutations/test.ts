import { builder } from '../builder';

builder.mutationField('test', (t) =>
	t.field({
		type: 'Boolean',
		resolve: async (_root, _args) => {
			return true;
		}
	})
);
