import { builder } from './builder';

import './mutations';
import './queries';
import './types';

builder.queryType({});
builder.mutationType({});
builder.subscriptionType({});

export const schema = builder.toSchema();
