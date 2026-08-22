import mongoose from 'mongoose';

/**
 * Returns a Mongoose query object for finding by id (uuid or 24-char ObjectId).
 * Use with Model.findOne(idQuery(id)).
 */
export const idQuery = (
  id: string
): { _id: mongoose.Types.ObjectId } | { uuid: string } => {
  const byId = mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
  return byId ? { _id: new mongoose.Types.ObjectId(id) } : { uuid: id };
};
