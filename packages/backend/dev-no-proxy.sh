#!/bin/bash
# Start wrangler dev without proxy

# Unset all proxy environment variables
unset http_proxy
unset https_proxy
unset HTTP_PROXY
unset HTTPS_PROXY
unset all_proxy
unset ALL_PROXY

# Keep the local D1 schema ready for context and translation memory features.
npx wrangler d1 execute webtrans-memory --local --file=./src/db/schema.sql >/dev/null

# Start wrangler dev
npx wrangler dev
