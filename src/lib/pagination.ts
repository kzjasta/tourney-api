const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const parsePagination = (query: Record<string, unknown>) => {
  const limit = Math.min(
    Math.max(
      1,
      parseInt(String(query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    ),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(String(query.offset || 0), 10) || 0);
  return { limit, offset };
};
