import { builder } from './builder';

import './mutations';
import './queries';
import './types';

builder.queryType({});
builder.mutationType({});

export const schema = builder.toSchema();
