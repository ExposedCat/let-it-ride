import { Composer } from "grammy";
import type { Context } from "./bot.ts";
import { saveRollPrompt } from "./chat.ts";

export const promptComposer = new Composer<Context>();

promptComposer.chatType("private").on("message:text", async (ctx, next) => {
  const chatId = ctx.session.selectedChatId;
  if (chatId === undefined) {
    await next();
    return;
  }

  const userId = ctx.from.id;
  const prompt = ctx.message.text;

  await saveRollPrompt({
    chatId,
    userId,
    name:
      [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") ||
      ctx.from.username ||
      String(userId),
    prompt,
    database: ctx.database,
  });

  await ctx.reply(ctx.t("prompt_saved"));
});
