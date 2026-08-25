import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 5 types params as string | string[] for repeatable segments; this API
// only declares single-value params like /:id.
type Params = Record<string, string>;

type AsyncRequestHandler<B, P extends Params> = (
  req: Request<P, unknown, B>,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

// B names the validated body type, so handlers behind validateBody read req.body
// without a cast.
export const asyncHandler =
  <B = unknown, P extends Params = Params>(
    fn: AsyncRequestHandler<B, P>
  ): RequestHandler<P, unknown, B> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
