import type { UserRole } from '../models/User';

export interface PublicUser {
  uuid: string;
  username: string;
  email: string;
  role: UserRole;
}

export const toPublicUser = (user: PublicUser): PublicUser => ({
  uuid: user.uuid,
  username: user.username,
  email: user.email,
  role: user.role,
});
