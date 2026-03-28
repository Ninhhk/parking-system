# PayOS Configuration Guide

This document must never contain real PayOS credentials.

## Required Secrets

Use environment variables or a secret manager for all sensitive values:

- `PAYOS_CLIENT_ID=<PAYOS_CLIENT_ID>`
- `PAYOS_API_KEY=<PAYOS_API_KEY>`
- `PAYOS_CHECKSUM_KEY=<PAYOS_CHECKSUM_KEY>`

## Secure Setup

1. Store PayOS credentials in your runtime secret store (Vault, cloud secret manager, CI secrets).
2. Inject secrets into the application environment at deploy/run time.
3. Keep `.env.example` as placeholders only.
4. Never commit real API keys to source control.

## If Credentials Were Exposed

1. Rotate all exposed keys immediately in the PayOS dashboard.
2. Invalidate old credentials.
3. Review git history and remove leaked secrets if needed.
4. Redeploy services with the rotated keys.
