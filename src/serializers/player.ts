import mongoose from 'mongoose';

export const populatePlayer = (query: mongoose.Query<any, any>) =>
  query.populate('team', 'uuid name coach').lean();
