import { z } from 'zod';

// .strict() is the guard against mass assignment: role, password and
// tokenVersion are rejected here rather than silently ignored.
export const updateUserSchema = z
  .object({
    username: z
      .string({ error: 'Username must be a non-empty string' })
      .trim()
      .min(1, 'Username must be a non-empty string')
      .optional(),
    email: z
      .string({ error: 'Email must be a non-empty string' })
      .trim()
      .min(1, 'Email must be a non-empty string')
      .toLowerCase()
      .optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
