#!/bin/bash

rm -f drizzle/\*.sql
rm -rf drizzle/meta
docker exec -ti nova-postgres dropdb -U postgres -f 'nova'
docker exec -ti nova-postgres createdb -U postgres 'nova'
