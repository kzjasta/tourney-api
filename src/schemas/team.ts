import { z } from 'zod';

const NAME_REQUIRED = 'Team name is required';

export const createTeamSchema = z.object({
  name: z.string({ error: NAME_REQUIRED }).trim().min(1, NAME_REQUIRED),
  coach: z.string().trim().nullish(),
});

export const updateTeamSchema = z.object({
  name: z
    .string({ error: 'Team name must be a non-empty string' })
    .trim()
    .min(1, 'Team name must be a non-empty string')
    .optional(),
  coach: z.string().trim().nullish(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
