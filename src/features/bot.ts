import { createDebug } from "@grammyjs/debug";
import {
  Bot,
  type Context as GrammyContext,
  type SessionFlavor,
  session,
} from "grammy";
import { I18n, type I18nFlavor } from "grammy-i18n";
import { chatComposer } from "./chat.ts";
import type { Database } from "./database.ts";
import { promptComposer } from "./prompt.ts";
import { stateComposer } from "./state.ts";

type SessionData = {
  selectedChatId?: number;
};

export type Context = GrammyContext &
  SessionFlavor<SessionData> &
  I18nFlavor & {
    database: Database;
  };

export function initBot(token: string, database: Database) {
  const logError = createDebug("app:bot:error");

  const bot = new Bot<Context>(token);

  const i18n = new I18n<Context>({
    directory: "locales",
    defaultLocale: "en",
  });

  bot.use((ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    ctx.database = database;
    return next();
  });

  bot.use(session({ initial: (): SessionData => ({}) }));
  bot.use(i18n);

  bot.use(chatComposer);
  bot.use(stateComposer);
  bot.use(promptComposer);

  bot.catch((error) => logError("Grammy error", { error }));

  return () =>
    new Promise((resolve) =>
      bot.start({
        onStart: () => resolve(undefined),
      }),
    );
}
