import { Composer, InlineKeyboard } from "grammy";
import type { Context } from "./bot.ts";
import { getUserChats, getUserTodaysRoll } from "./chat.ts";

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

stateComposer.callbackQuery(/chat:/, async (ctx) => {
  const chatId = Number(ctx.callbackQuery.data.split(":")[1]);
  const roll = await getUserTodaysRoll({
    chatId,
    userId: ctx.from.id,
    database: ctx.database,
  });
  if (!roll) {
    await ctx.answerCallbackQuery(ctx.t("chat_not_found"));
    return;
  }

  ctx.session.selectedChatId = chatId;

  await ctx.answerCallbackQuery();
  await ctx.reply(
    ctx.t(roll.prompt ? "chat_with_prompt" : "empty_chat", {
      chat: roll.chatTitle,
      prompt: roll.prompt ?? "",
    }),
  );
});
