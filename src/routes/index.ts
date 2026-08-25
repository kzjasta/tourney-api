import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import authRouter from './auth';
import playersRouter from './players';
import teamsRouter from './teams';
import usersRouter from './users';

const router = Router();

router.use('/auth', authRouter);
router.use('/players', requireAuth, playersRouter);
router.use('/teams', requireAuth, teamsRouter);
router.use('/users', requireAuth, usersRouter);

export default router;
