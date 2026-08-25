import dotenv from 'dotenv';

// Jest sets NODE_ENV=test; skip .env there so a developer's local MONGODB_URI
// never causes the test suite to talk to a real database.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

const DEV_ACCESS_SECRET = 'dev-only-access-secret-do-not-use-in-production';
const DEV_REFRESH_SECRET = 'dev-only-refresh-secret-do-not-use-in-production';

const requireInProduction = (
  name: string,
  value: string | undefined,
  devFallback: string
): string => {
  if (value) return value;
  if (isProduction) {
    throw new Error(`${name} must be set in production`);
  }
  return devFallback;
};

const parseOrigins = (value: string | undefined): string[] | true => {
  if (!value || value === '*') return isProduction ? [] : true;
  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
};

export const config = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 3000),
  mongodbUri: process.env.MONGODB_URI,
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN),
  accessTokenSecret: requireInProduction(
    'JWT_ACCESS_SECRET',
    process.env.JWT_ACCESS_SECRET,
    DEV_ACCESS_SECRET
  ),
  refreshTokenSecret: requireInProduction(
    'JWT_REFRESH_SECRET',
    process.env.JWT_REFRESH_SECRET,
    DEV_REFRESH_SECRET
  ),
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  refreshTokenMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  bcryptRounds: 12,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 100,
  credentialsRateLimitMax: 10,
  defaultPageSize: 50,
  maxPageSize: 100,
});

if (!isProduction && !process.env.JWT_ACCESS_SECRET && NODE_ENV !== 'test') {
  console.warn(
    '[config] JWT_ACCESS_SECRET not set - using an insecure development secret.'
  );
}
