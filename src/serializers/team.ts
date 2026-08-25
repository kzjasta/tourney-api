import mongoose from 'mongoose';
import Player, { type PlayerPosition } from '../models/Player';
import type { ITeam } from '../models/Team';

const PLAYER_FIELDS =
  'uuid firstName lastName position dateOfBirth jerseyNumber height';
const OWNER_FIELDS = 'uuid username email';

// The lean + populate result does not match the document type, so the response
// shape is declared here.
export interface TeamPlayerView {
  uuid: string;
  firstName: string;
  lastName: string;
  position?: PlayerPosition;
  dateOfBirth?: Date;
  jerseyNumber?: number;
  height?: string;
}

export interface TeamView {
  uuid: string;
  name: string;
  coach?: string | null;
  players: TeamPlayerView[];
  createdBy: { uuid: string; username: string; email: string };
}

interface RawTeam {
  _id: mongoose.Types.ObjectId;
  uuid: string;
  name: string;
  coach?: string | null;
  createdBy: { uuid: string; username: string; email: string };
}

type RosterRow = TeamPlayerView & { team: mongoose.Types.ObjectId };

// Jersey numbers are unique per team, so only unnumbered players can tie.
const byJerseyNumber = (a: TeamPlayerView, b: TeamPlayerView) => {
  if (a.jerseyNumber != null && b.jerseyNumber != null) {
    return a.jerseyNumber - b.jerseyNumber;
  }
  if (a.jerseyNumber != null) return -1;
  if (b.jerseyNumber != null) return 1;
  return `${a.lastName} ${a.firstName}`.localeCompare(
    `${b.lastName} ${b.firstName}`
  );
};

/** Rosters are derived from Player.team, fetched in one query for all teams. */
const attachRosters = async (teams: RawTeam[]): Promise<TeamView[]> => {
  if (teams.length === 0) return [];

  const rows = (await Player.find({ team: { $in: teams.map(t => t._id) } })
    .select(`${PLAYER_FIELDS} team`)
    .lean()) as unknown as RosterRow[];

  const byTeam = new Map<string, TeamPlayerView[]>();
  for (const { team, ...player } of rows) {
    const key = String(team);
    const roster = byTeam.get(key) ?? [];
    roster.push(player);
    byTeam.set(key, roster);
  }

  return teams.map(({ _id, ...team }) => ({
    ...team,
    players: (byTeam.get(String(_id)) ?? []).sort(byJerseyNumber),
  }));
};

export const populateTeam = async (
  query: mongoose.Query<unknown, unknown>
): Promise<TeamView | null> => {
  const team = (await query
    .populate('createdBy', OWNER_FIELDS)
    .lean()) as unknown as RawTeam | null;
  if (!team) return null;

  const [view] = await attachRosters([team]);
  return view;
};

export const populateTeams = async (
  query: mongoose.Query<unknown, unknown>
): Promise<TeamView[]> => {
  const teams = (await query
    .populate('createdBy', OWNER_FIELDS)
    .lean()) as unknown as RawTeam[];
  return attachRosters(teams);
};

/** Populates a document already in hand, avoiding a refetch by id. */
export const serializeTeam = async (doc: ITeam): Promise<TeamView> => {
  const raw = (
    await doc.populate('createdBy', OWNER_FIELDS)
  ).toObject() as unknown as RawTeam;
  const [view] = await attachRosters([raw]);
  return view;
};
