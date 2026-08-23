import { z } from 'zod';
import { PLAYER_POSITIONS } from '../models/Player';

const NAMES_REQUIRED = 'First name and last name are required';

// A team uuid or ObjectId; null clears the assignment.
const teamRef = z.union([z.string().trim(), z.null()]);

// Unknown keys are stripped rather than rejected, so a client cannot set
// createdBy or team directly by smuggling it through the body.
export const createPlayerSchema = z.object({
  firstName: z.string({ error: NAMES_REQUIRED }).trim().min(1, NAMES_REQUIRED),
  lastName: z.string({ error: NAMES_REQUIRED }).trim().min(1, NAMES_REQUIRED),
  position: z.enum(PLAYER_POSITIONS).optional(),
  dateOfBirth: z.coerce.date().optional(),
  jerseyNumber: z.number().int().optional(),
  height: z.string().trim().optional(),
  team: teamRef.optional(),
});

export const updatePlayerSchema = createPlayerSchema.partial();

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
