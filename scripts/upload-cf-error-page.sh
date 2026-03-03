#!/usr/bin/env bash
set -euo pipefail

npx wrangler r2 object put ai-grija-cdn/cf-error.html \
  --file src/static/cf-error.html \
  --content-type "text/html;charset=UTF-8" \
  --cache-control "public, max-age=300"
