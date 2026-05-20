import { Database as SQLiteDatabase } from "@db/sqlite";
import { type ColumnType, Kysely, sql } from "@kysely/kysely";
import { DenoSqlite3Dialect } from "@marshift/kysely-deno-sqlite3";

type ReadonlyColumn<T> = ColumnType<T, T, never>;

export type DatabaseSchema = {
  chats: {
    id: ReadonlyColumn<number>;
    title: string;
  };
  chat_users: {
    chat_id: ReadonlyColumn<number>;
    user_id: ReadonlyColumn<number>;
  };
  rolls: {
    chat_id: ReadonlyColumn<number>;
    timestamp: ReadonlyColumn<number>;
    id: string;
    winner: number | null;
    win_reason: string | null;
  };
  roll_bets: {
    chat_id: ReadonlyColumn<number>;
    roll_timestamp: ReadonlyColumn<number>;
    user_id: ReadonlyColumn<number>;
    prompt: string;
  };
};

export type Database = Kysely<DatabaseSchema>;

async function migrate(database: Database) {
  await sql`PRAGMA foreign_keys = ON`.execute(database);
  await sql`PRAGMA journal_mode = WAL`.execute(database);

  await database.schema
    .createTable("chats")
    .ifNotExists()
    .addColumn("id", "integer", (column) => column.primaryKey())
    .addColumn("title", "text", (column) => column.notNull())
    .execute();

  await database.schema
    .createTable("chat_users")
    .ifNotExists()
    .addColumn("chat_id", "integer", (column) => column.notNull())
    .addColumn("user_id", "integer", (column) => column.notNull())
    .addPrimaryKeyConstraint("chat_users_pk", ["chat_id", "user_id"])
    .addForeignKeyConstraint(
      "chat_users_chat_id_fk",
      ["chat_id"],
      "chats",
      ["id"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .execute();

  await database.schema
    .createTable("rolls")
    .ifNotExists()
    .addColumn("chat_id", "integer", (column) => column.notNull())
    .addColumn("timestamp", "integer", (column) => column.notNull())
    .addColumn("id", "text", (column) => column.notNull())
    .addColumn("winner", "integer")
    .addColumn("win_reason", "text")
    .addPrimaryKeyConstraint("rolls_pk", ["chat_id", "timestamp"])
    .addForeignKeyConstraint(
      "rolls_chat_id_fk",
      ["chat_id"],
      "chats",
      ["id"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .execute();

  await database.schema
    .createTable("roll_bets")
    .ifNotExists()
    .addColumn("chat_id", "integer", (column) => column.notNull())
    .addColumn("roll_timestamp", "integer", (column) => column.notNull())
    .addColumn("user_id", "integer", (column) => column.notNull())
    .addColumn("prompt", "text", (column) => column.notNull())
    .addPrimaryKeyConstraint("roll_bets_pk", [
      "chat_id",
      "roll_timestamp",
      "user_id",
    ])
    .addForeignKeyConstraint(
      "roll_bets_roll_fk",
      ["chat_id", "roll_timestamp"],
      "rolls",
      ["chat_id", "timestamp"],
      (constraint) => constraint.onDelete("cascade"),
    )
    .execute();
}

export function initDatabase() {
  const path = Deno.env.get("SQLITE_PATH") ?? "let-it-ride.sqlite";

  const connect = async (): Promise<Database> => {
    const database = new Kysely<DatabaseSchema>({
      dialect: new DenoSqlite3Dialect({
        database: new SQLiteDatabase(path, { int64: true }),
      }),
    });

    await migrate(database);
    return database;
  };

  return connect;
}
