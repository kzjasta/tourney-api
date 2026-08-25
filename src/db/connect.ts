import mongoose from 'mongoose';

export const connectDb = (uri: string) => mongoose.connect(uri);

export const disconnectDb = () => mongoose.disconnect();
