# Telegram Bot Template

State of the art starter for TypeScript + MongoDb Telegram Bots

## Stack
- TypeScript & Deno
- grammY as a core framework
- grammY/debug as a logger
- Biome as all-in-one codestyle enforcer
- MongoDB as a database
- Typebox for database validation

## Development

1. Copy `.env.template` to `.env`
2. Set `BOT_TOKEN`
3. Start MongoDB locally
4. Run `deno task dev`

## Docker Compose

1. Copy `.env.template` to `.env`
2. Set `BOT_TOKEN`
3. Run `docker compose up --build -d`

The Compose stack starts both the bot and MongoDB. The app container overrides
`MONGODB_URI` to use the internal `mongodb` hostname, so the `.env` example
still works for local non-Docker development.
