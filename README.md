# Telegram Bot Template

State of the art starter for TypeScript + SQLite Telegram Bots

## Stack
- TypeScript & Deno
- grammY as a core framework
- grammY/debug as a logger
- Biome as all-in-one codestyle enforcer
- SQLite as a database
- Kysely as a typed query builder

## Development

1. Copy `.env.template` to `.env`
2. Set `BOT_TOKEN`
3. Run `deno task dev`

## Docker Compose

1. Copy `.env.template` to `.env`
2. Set `BOT_TOKEN`
3. Run `docker compose up --build -d`

The Compose stack stores SQLite data in the `let-it-ride-sqlite-data` volume.
Set `SQLITE_PATH` in `.env` to override the local database file path.
