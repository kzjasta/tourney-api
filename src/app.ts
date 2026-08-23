import express from 'express';
import morgan from 'morgan';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import authRouter from './routes/auth';
import playersRouter from './routes/players';
import teamsRouter from './routes/teams';
import usersRouter from './routes/users';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.isTest,
  })
);
app.use(morgan('dev', { skip: () => config.isTest }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState });
});

app.use('/auth', authRouter);
app.use('/players', requireAuth, playersRouter);
app.use('/teams', requireAuth, teamsRouter);
app.use('/users', requireAuth, usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);

if (config.mongodbUri) {
  mongoose
    .connect(config.mongodbUri)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
}

export { app };
