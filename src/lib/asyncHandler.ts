import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 5 types params as string | string[] for repeatable segments; this API
// only declares single-value params like /:id.
type Params = Record<string, string>;

type AsyncRequestHandler<P extends Params = Params> = (
  req: Request<P>,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler =
  <P extends Params = Params>(fn: AsyncRequestHandler<P>): RequestHandler<P> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
