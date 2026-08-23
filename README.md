# Tourney API

Node.js API with TypeScript, Express, Mongoose, and Morgan.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your credentials (e.g. `PORT`, `MONGODB_URI`).

## Scripts

- `npm run dev` – run with ts-node (development)
- `npm run build` – compile TypeScript to `dist/`
- `npm start` – run compiled app (`dist/index.js`)
- `npm test` – run Jest unit tests
- `npm run test:watch` – run tests in watch mode

## Running the server

```bash
npm run dev
```

You should see: **Tourney API on Port 3000** (or your configured `PORT`).

## Authentication

Every route except `/health` and `/auth/*` requires a bearer token.

| Route                 | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `POST /auth/register` | Create an account, returns an access token       |
| `POST /auth/login`    | Exchange email + password for an access token    |
| `POST /auth/refresh`  | Issue a new access token from the refresh cookie |
| `POST /auth/logout`   | Revoke every refresh token for the user          |
| `GET /auth/me`        | Current user                                     |

Access tokens are short-lived (15m) and sent as `Authorization: Bearer <token>`.
The refresh token is a 30-day httpOnly cookie scoped to `/auth`; browser clients
must send requests with credentials enabled.

Roles are `admin`, `organizer` (default), `coach` and `player`. Teams and players
are owned by the user who created them — a non-admin can only read or modify
their own records.
