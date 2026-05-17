import { type Static, Type } from "typebox";

export const userSchema = Type.Object({
  id: Type.Number(),
  chats: Type.Array(Type.Number()),
});

export type User = Static<typeof userSchema>;
