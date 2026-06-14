import { z } from 'zod'

export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/u, 'must be lowercase letters, digits, and dashes')

export const EmailSchema = z.string().email()

export const NonEmptyStringSchema = z.string().min(1)

export function safeParse<T extends z.ZodTypeAny>(schema: T, value: unknown) {
  const result = schema.safeParse(value)
  return result.success
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error }
}
