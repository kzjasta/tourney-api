import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string({ error: 'Username is required' })
    .trim()
    .min(1, 'Username is required'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .toLowerCase(),
  password: z
    .string({ error: 'Password must be at least 8 characters' })
    .min(8, 'Password must be at least 8 characters'),
});

const CREDENTIALS_REQUIRED = 'Email and password are required';

export const loginSchema = z.object({
  email: z.string({ error: CREDENTIALS_REQUIRED }).trim().toLowerCase(),
  password: z.string({ error: CREDENTIALS_REQUIRED }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
