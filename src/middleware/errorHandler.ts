import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { isHttpError } from '../lib/httpError';

const isDuplicateKeyError = (err: unknown): boolean =>
  !!err && typeof err === 'object' && 'code' in err && err.code === 11000;

const duplicateKeyField = (err: unknown): string | null => {
  const pattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
  return pattern ? (Object.keys(pattern)[0] ?? null) : null;
};

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // Express only treats a handler as an error handler when it declares 4 params.
  _next: NextFunction
) => {
  if (!config.isTest) {
    console.error(err);
  }

  if (isHttpError(err)) {
    return res.status(err.status).json({ error: err.message });
  }

  if (isDuplicateKeyError(err)) {
    const field = duplicateKeyField(err);
    return res.status(409).json({
      error: field ? `That ${field} is already taken` : 'Duplicate entry',
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: err.message });
  }

  if (
    err instanceof Error &&
    err.message === 'Jersey number already in use on this team'
  ) {
    return res.status(409).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
};
