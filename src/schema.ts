import { builder } from './builder';

import './types';
import './queries';
import './mutations';

builder.queryType({});
builder.mutationType({});

export const schema = builder.toSchema();
