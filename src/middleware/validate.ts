import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { HttpError } from '../lib/httpError';

/** Replaces req.body with the parsed value, so handlers receive coerced, trimmed data. */
export const validateBody =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const [issue] = result.error.issues;
      return next(new HttpError(400, issue?.message ?? 'Invalid request body'));
    }
    req.body = result.data;
    next();
  };
