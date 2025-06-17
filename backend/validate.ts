import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

export const sanitize = (str: string) => str.replace(/[<>"'&]/g, "")

export const CreateRoomRequestSchema = z.object({
  userName: z.string().min(1).max(24).transform(sanitize),
})

export const JoinRoomRequestSchema = z.object({
  userName: z.string().min(1).max(24).transform(sanitize),
  userToken: z.string().optional(),
})

export const LeaveRoomRequestSchema = z.object({
  userToken: z.string().min(1),
})

export const UserNameSchema = z.string().min(1).max(24).transform(sanitize)
export const AnswerSchema = z.string().max(256).transform(sanitize)

// バリデーション用スキーマをまとめてエクスポート
export const Schemas = {
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  LeaveRoomRequestSchema,
  UserNameSchema,
  AnswerSchema,
}
