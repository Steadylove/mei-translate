#!/bin/bash
# Start wrangler dev without proxy

# Unset all proxy environment variables
unset http_proxy
unset https_proxy
unset HTTP_PROXY
unset HTTPS_PROXY
unset all_proxy
unset ALL_PROXY

# Start wrangler dev
npx wrangler dev
