import mongoose from 'mongoose';

export const populateTeam = (query: mongoose.Query<any, any>) =>
  query
    .populate(
      'players',
      'uuid firstName lastName position dateOfBirth jerseyNumber height'
    )
    .populate('createdBy', 'uuid username email')
    .lean();
