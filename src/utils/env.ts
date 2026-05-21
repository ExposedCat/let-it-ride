export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export const APP_ENV = {
  BOT_TOKEN: getRequiredEnv("BOT_TOKEN"),
  AI_API_BASE_URL: getRequiredEnv("AI_API_BASE_URL"),
  AI_MODEL: getRequiredEnv("AI_MODEL"),
  AI_API_KEY: getRequiredEnv("AI_API_KEY"),
  SQLITE_PATH: Deno.env.get("SQLITE_PATH") ?? "let-it-ride.sqlite",
} as const;
