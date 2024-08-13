#!/bin/sh

pwd

echo "Migrating database..."
bun db:migrate & PID=$!
# Wait for migration to finish
wait $PID

echo "Starting production server..."
bun dev & PID=$!

wait $PID