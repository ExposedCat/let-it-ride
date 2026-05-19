import { Composer, InlineKeyboard } from "grammy";
import type { Context } from "./bot.ts";
import { getUserChats } from "./chat.ts";

export const stateComposer = new Composer<Context>();

stateComposer.chatType("private").command("start", async (ctx) => {
  const chats = await getUserChats({
    userId: ctx.from.id,
    database: ctx.database,
  });
  await ctx.reply(ctx.t("start", { name: ctx.from.first_name }), {
    reply_markup: new InlineKeyboard(
      chats.map(({ id, title }) => [
        { text: title, callback_data: `chat:${id}` },
      ]),
    ),
  });
});
