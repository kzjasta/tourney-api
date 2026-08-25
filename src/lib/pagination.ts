import { config } from '../config/env';

export const parsePagination = (query: Record<string, unknown>) => {
  const limit = Math.min(
    Math.max(
      1,
      parseInt(String(query.limit || config.defaultPageSize), 10) ||
        config.defaultPageSize
    ),
    config.maxPageSize
  );
  const offset = Math.max(0, parseInt(String(query.offset || 0), 10) || 0);
  return { limit, offset };
};
