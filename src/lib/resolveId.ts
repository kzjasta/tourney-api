import mongoose, { FilterQuery, Model } from 'mongoose';
import { idQuery } from './idQuery';

/** Resolves a uuid or ObjectId string to the document's _id, or null if absent. */
export const resolveId = async <T>(
  model: Model<T>,
  id: string
): Promise<mongoose.Types.ObjectId | null> => {
  const doc = await model
    .findOne(idQuery(id) as FilterQuery<T>)
    .select('_id')
    .lean()
    .exec();
  return doc ? (doc._id as mongoose.Types.ObjectId) : null;
};
