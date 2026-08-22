import express from 'express';
import morgan from 'morgan';
import mongoose from 'mongoose';
import playersRouter from './routes/players';
import teamsRouter from './routes/teams';
import usersRouter from './routes/users';

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.use('/players', playersRouter);
app.use('/teams', teamsRouter);
app.use('/users', usersRouter);

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
}

export { app };
