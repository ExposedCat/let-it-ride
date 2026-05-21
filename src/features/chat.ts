import { Composer } from "grammy";
import type { Context } from "./bot.ts";
import type { Database } from "./database.ts";
import { evaluateWinner } from "./llm.ts";

type RollBet = {
  userId: number;
  prompt: string;
};

type TodaysPrompt = RollBet & {
  name: string;
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

chatComposer
  .chatType(["group", "supergroup"])
  .on("message", async (ctx, next) => {
    await saveChatUser({
      chatId: ctx.chat.id,
      title: ctx.chat.title ?? "Unknown chat",
      userId: ctx.from?.id,
      name: ctx.from ? getUserName(ctx.from) : undefined,
      database: ctx.database,
    });

    await next();
  });

chatComposer
  .chatType(["group", "supergroup"])
  .command("letitride", async (ctx) => {
    await ctx.reply(ctx.t("letitride_started"));

    const prompts = await getTodaysPrompts({
      chatId: ctx.chat.id,
      database: ctx.database,
    });

    if (prompts.length === 0) {
      await ctx.reply(ctx.t("letitride_no_prompts"));
      return;
    }

    const evaluation = await evaluateWinner(prompts, {
      onPromptInjectionEvaluated: async () => {
        await ctx.reply(ctx.t("letitride_rolling"));
      },
    });
    const elaboration = renderPlayerNames(evaluation.elaboration, prompts);

    await saveRollResult({
      chatId: ctx.chat.id,
      winner: evaluation.winner,
      winReason: elaboration,
      database: ctx.database,
    });

    await ctx.reply(elaboration);
  });

function getTodayTimestamp() {
  return new Date().setHours(0, 0, 0, 0);
}

function getUserName(user: NonNullable<Context["from"]>) {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    String(user.id)
  );
}

function renderPlayerNames(text: string, prompts: TodaysPrompt[]) {
  return prompts.reduce(
    (message, { userId, name }) => message.replaceAll(`$name:${userId}`, name),
    text,
  );
}

type SaveChatUserParams = {
  chatId: number;
  title: string;
  userId?: number;
  name?: string;
  database: Database;
};

export async function saveChatUser({
  chatId,
  title,
  userId,
  name,
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
    .values({
      chat_id: chatId,
      user_id: userId,
      name: name ?? String(userId),
    })
    .onConflict((conflict) =>
      conflict.columns(["chat_id", "user_id"]).doUpdateSet({
        name: name ?? String(userId),
      }),
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
    .where("chats.id", "!=", userId)
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
        .on("rolls.timestamp", "=", getTodayTimestamp()),
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

type GetTodaysPromptsParams = {
  chatId: number;
  database: Database;
};

export function getTodaysPrompts({ chatId, database }: GetTodaysPromptsParams) {
  return database
    .selectFrom("roll_bets")
    .innerJoin("chat_users", (join) =>
      join
        .onRef("chat_users.chat_id", "=", "roll_bets.chat_id")
        .onRef("chat_users.user_id", "=", "roll_bets.user_id"),
    )
    .select([
      "roll_bets.user_id as userId",
      "chat_users.name",
      "roll_bets.prompt",
    ])
    .where("roll_bets.chat_id", "=", chatId)
    .where("roll_bets.roll_timestamp", "=", getTodayTimestamp())
    .where("roll_bets.prompt", "!=", "")
    .orderBy("chat_users.name")
    .execute();
}

type SaveRollPromptParams = {
  chatId: number;
  userId: number;
  name?: string;
  prompt: string;
  database: Database;
};

export async function saveRollPrompt({
  chatId,
  userId,
  name,
  prompt,
  database,
}: SaveRollPromptParams) {
  const timestamp = getTodayTimestamp();
  const rollId = `${chatId}:${timestamp}`;

  await database.transaction().execute(async (transaction) => {
    await transaction
      .insertInto("chats")
      .values({ id: chatId, title: "Unknown chat" })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();

    await transaction
      .insertInto("chat_users")
      .values({
        chat_id: chatId,
        user_id: userId,
        name: name ?? String(userId),
      })
      .onConflict((conflict) =>
        conflict.columns(["chat_id", "user_id"]).doUpdateSet({
          name: name ?? String(userId),
        }),
      )
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

type SaveRollResultParams = {
  chatId: number;
  winner: number;
  winReason: string;
  database: Database;
};

async function saveRollResult({
  chatId,
  winner,
  winReason,
  database,
}: SaveRollResultParams) {
  await database
    .updateTable("rolls")
    .set({ winner, win_reason: winReason })
    .where("chat_id", "=", chatId)
    .where("timestamp", "=", getTodayTimestamp())
    .execute();
}
