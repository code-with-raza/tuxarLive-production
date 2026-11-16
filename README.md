# Tuxar website

Application source for the Tuxar storefront and administration panel.

## Development

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to a local `.env` and
configure only the public browser settings, then run `npm run dev`.

## Automatic deployment

See [the deployment guide](docs/automatic-deployment.md). Production publishing
is disabled until the GitHub production environment and repository variables
are configured. FTPS is supported without a cPanel terminal.

## Private data

This repository contains application code, database schema migrations and
synthetic tests. Production database dumps, customer/order exports, real
environment files, deployment credentials, backup archives and previous Git
history are excluded. Keep server credentials in GitHub/Supabase secrets.

The files in `supabase/migrations` define application behavior and permissions;
they are not exports of customer records. Do not run legacy seed/import scripts
against an existing production database. Follow the migration-history checks in
the deployment guide.
