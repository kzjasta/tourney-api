import { app } from './app';
import { config } from './config/env';
import { connectDb } from './db/connect';

const start = async () => {
  if (config.mongodbUri) {
    await connectDb(config.mongodbUri);
    console.log('MongoDB connected');
  } else {
    console.warn(
      '[startup] MONGODB_URI not set - starting without a database.'
    );
  }

  app.listen(config.port, () => {
    console.log(`Tourney API on Port ${config.port}`);
  });
};

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
