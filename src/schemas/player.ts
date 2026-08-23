import { PLAYER_POSITIONS, type PlayerPosition } from '../models/Player';

export interface PlayerInput {
  firstName?: string;
  lastName?: string;
  position?: PlayerPosition;
  dateOfBirth?: Date;
  jerseyNumber?: number;
  height?: string;
  teamId?: string;
}

const parseString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : undefined;

const parseDate = (value: unknown) => {
  const d =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : undefined;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
};

const parseInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

const parsePosition = (value: unknown) =>
  typeof value === 'string' &&
  PLAYER_POSITIONS.includes(value as PlayerPosition)
    ? (value as PlayerPosition)
    : undefined;

export const parsePlayerBody = (body: Record<string, unknown>): PlayerInput => {
  const {
    firstName,
    lastName,
    position,
    dateOfBirth,
    jerseyNumber,
    height,
    team: teamId,
  } = body;

  return {
    ...(firstName !== undefined && { firstName: parseString(firstName) }),
    ...(lastName !== undefined && { lastName: parseString(lastName) }),
    ...(position !== undefined && { position: parsePosition(position) }),
    ...(dateOfBirth !== undefined && { dateOfBirth: parseDate(dateOfBirth) }),
    ...(jerseyNumber !== undefined && {
      jerseyNumber: parseInteger(jerseyNumber),
    }),
    ...(height !== undefined && { height: parseString(height) }),
    ...(teamId !== undefined && { teamId: teamId as string }),
  };
};
