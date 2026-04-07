$ErrorActionPreference = "Stop"

# Runs frontend + all Cloudflare workers in ONE terminal using pnpm parallel filters.
# Usage:
#   pnpm dev:all:windows
#
# Notes:
# - Each worker still needs its own `.dev.vars` / secrets to be set.
# - Cloudflare Queues are often easier to test with `wrangler dev --remote` or deploy.

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $repo  # scripts/ -> repo root
Set-Location $repo

pnpm dev:all
