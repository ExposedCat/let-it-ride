import { Composer } from "grammy";
import type { Context } from "./bot.ts";
import type { Database } from "./database.ts";

type RollBet = {
  userId: number;
  prompt: string;
};

type Roll = {
  id: string;
  bets: RollBet[];
  winner?: number;
  winReason?: string;
  timestamp: number;
};

export type Chat = {
  id: number;
  title: string;
  rolls: Roll[];
  users: number[];
};

export const chatComposer = new Composer<Context>();

chatComposer.on("message", async (ctx, next) => {
  console.log(ctx.chat);
  await saveChatUser({
    chatId: ctx.chat.id,
    title: ctx.chat.title ?? "Unknown chat",
    userId: ctx.from?.id,
    database: ctx.database,
  });

  await next();
});

type SaveChatUserParams = {
  chatId: number;
  title: string;
  userId?: number;
  database: Database;
};

export async function saveChatUser({
  chatId,
  title,
  userId,
  database,
}: SaveChatUserParams) {
  await database
    .insertInto("chats")
    .values({ id: chatId, title })
    .onConflict((conflict) => conflict.column("id").doUpdateSet({ title }))
    .execute();

  if (userId === undefined) {
    return;
  }

  await database
    .insertInto("chat_users")
    .values({ chat_id: chatId, user_id: userId })
    .onConflict((conflict) =>
      conflict.columns(["chat_id", "user_id"]).doNothing(),
    )
    .execute();
}

type GetUserChatsParams = {
  userId: number;
  database: Database;
};

export function getUserChats({ userId, database }: GetUserChatsParams) {
  return database
    .selectFrom("chats")
    .innerJoin("chat_users", "chat_users.chat_id", "chats.id")
    .select(["chats.id", "chats.title"])
    .where("chat_users.user_id", "=", userId)
    .orderBy("chats.title")
    .execute();
}

type GetChatParams = {
  chatId: number;
  database: Database;
};

export async function getChat({
  chatId,
  database,
}: GetChatParams): Promise<Chat | undefined> {
  const chat = await database
    .selectFrom("chats")
    .select(["id", "title"])
    .where("id", "=", chatId)
    .executeTakeFirst();

  if (!chat) {
    return undefined;
  }

  const users = await database
    .selectFrom("chat_users")
    .select("user_id as userId")
    .where("chat_id", "=", chatId)
    .orderBy("user_id")
    .execute()
    .then((rows) => rows.map(({ userId }) => userId));

  const rollRows = await database
    .selectFrom("rolls")
    .select(["id", "timestamp", "winner", "win_reason as winReason"])
    .where("chat_id", "=", chatId)
    .orderBy("timestamp")
    .execute();

  const rolls = await Promise.all(
    rollRows.map(async ({ winner, winReason, ...roll }) => ({
      ...roll,
      bets: await database
        .selectFrom("roll_bets")
        .select(["user_id as userId", "prompt"])
        .where("chat_id", "=", chatId)
        .where("roll_timestamp", "=", roll.timestamp)
        .orderBy("user_id")
        .execute(),
      ...(winner === null ? {} : { winner }),
      ...(winReason === null ? {} : { winReason }),
    })),
  );

  return { ...chat, users, rolls };
}

type GetUserTodaysRollParams = {
  chatId: number;
  userId: number;
  database: Database;
};

export function getUserTodaysRoll({
  chatId,
  userId,
  database,
}: GetUserTodaysRollParams) {
  return database
    .selectFrom("chats")
    .leftJoin("rolls", (join) =>
      join
        .onRef("rolls.chat_id", "=", "chats.id")
        .on("rolls.timestamp", "=", new Date().setHours(0, 0, 0, 0)),
    )
    .leftJoin("roll_bets", (join) =>
      join
        .onRef("roll_bets.chat_id", "=", "rolls.chat_id")
        .onRef("roll_bets.roll_timestamp", "=", "rolls.timestamp")
        .on("roll_bets.user_id", "=", userId),
    )
    .select([
      "chats.id as chatId",
      "chats.title as chatTitle",
      "rolls.id as rollId",
      "roll_bets.prompt",
    ])
    .where("chats.id", "=", chatId)
    .executeTakeFirst();
}

type SaveRollPromptParams = {
  chatId: number;
  userId: number;
  prompt: string;
  database: Database;
};

export async function saveRollPrompt({
  chatId,
  userId,
  prompt,
  database,
}: SaveRollPromptParams) {
  const timestamp = new Date().setHours(0, 0, 0, 0);
  const rollId = `${chatId}:${timestamp}`;

  await database.transaction().execute(async (transaction) => {
    await transaction
      .insertInto("chats")
      .values({ id: chatId, title: "Unknown chat" })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();

    await transaction
      .insertInto("rolls")
      .values({
        chat_id: chatId,
        timestamp,
        id: rollId,
        winner: null,
        win_reason: null,
      })
      .onConflict((conflict) =>
        conflict.columns(["chat_id", "timestamp"]).doNothing(),
      )
      .execute();

    await transaction
      .insertInto("roll_bets")
      .values({
        chat_id: chatId,
        roll_timestamp: timestamp,
        user_id: userId,
        prompt,
      })
      .onConflict((conflict) =>
        conflict.columns(["chat_id", "roll_timestamp", "user_id"]).doUpdateSet({
          prompt,
        }),
      )
      .execute();
  });
}
