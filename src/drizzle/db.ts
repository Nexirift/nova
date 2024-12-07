import { drizzle as prodDrizzle } from 'drizzle-orm/node-postgres'; // for production use
import { Client as prodClient } from 'pg'; // for production use
import * as schema from './schema'; // get all the schema

export const prodDbClient = new prodClient({
	connectionString: Bun.env.DATABASE_URL as string
});

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgliteDatabase } from 'drizzle-orm/pglite';

let db:
	| (NodePgDatabase<typeof schema> & { $client: prodClient })
	| (PgliteDatabase<typeof schema> & { $client: any });

if (Bun.env.NODE_ENV !== 'test') {
	db = prodDrizzle(prodDbClient, { schema }); // we want to use a real database
} else {
	import('@electric-sql/pglite').then(({ PGlite: testClient }) => {
		import('drizzle-orm/pglite').then(({ drizzle: testDrizzle }) => {
			// @ts-ignore - TODO: fix later
			import('@electric-sql/pglite/contrib/citext').then(({ citext }) => {
				db = testDrizzle(new testClient({ extensions: { citext } }), {
					schema
				}); // we want to use an in-memory database
			});
		});
	});
}

export { db };
