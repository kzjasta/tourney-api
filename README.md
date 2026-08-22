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
