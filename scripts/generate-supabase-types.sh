#!/bin/sh

set -e

if [ -f .env ]; then
  source .env
else
  echo ".env file not found, continuing without it."
fi

mkdir -p types

npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > types/database.types.ts
