import { Composer } from "grammy";
import { type Static, Type } from "typebox";
import type { Context } from "./bot.ts";
import type { Database } from "./database.ts";

export const chatSchema = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  rolls: Type.Array(
    Type.Object({
      id: Type.String(),
      bets: Type.Array(
        Type.Object({
          userId: Type.Number(),
          prompt: Type.String(),
        }),
      ),
      winner: Type.Optional(Type.Number()),
      winReason: Type.Optional(Type.String()),
      timestamp: Type.Number(),
    }),
  ),
  users: Type.Array(Type.Number()),
});

export type Chat = Static<typeof chatSchema>;

export const chatComposer = new Composer<Context>();

chatComposer.on("message", async (ctx, next) => {
  await ctx.database.chat.updateOne(
    { id: ctx.chat.id },
    {
      $addToSet: {
        users: ctx.from ? ctx.from.id : undefined,
      },
      $setOnInsert: {
        id: ctx.chat.id,
        title: ctx.chat.title ?? "Unknown chat",
        rolls: [],
      },
    },
    { upsert: true },
  );

  await next();
});

type GetUserChatsParams = {
  userId: number;
  database: Database;
};

export async function getUserChats({ userId, database }: GetUserChatsParams) {
  const chats = await database.chat.find({ users: userId }).toArray();
  return chats.map(({ id, title }) => ({ id, title }));
}
