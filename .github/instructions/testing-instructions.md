---
applyTo: 'src/tests/**/*.spec.ts'
description: 'Testing conventions for tourney-api, adapted from nodejs-testing-best-practices.'
---

# Testing Instructions

Adapted from [nodejs-testing-best-practices](https://github.com/goldbergyoni/nodejs-testing-best-practices).
Only the practices that apply to this stack (Express + Mongoose + Jest + supertest + `mongodb-memory-server`) are listed.

## Strategy

- **Start with component tests.** Test the whole component through its HTTP API with the real (in-memory) database and all layers included. These live in `src/tests/*.spec.ts` and are the primary safety net.
- **Add service-level tests only for non-trivial logic.** `src/tests/services/*.spec.ts` covers ownership rules and service edge cases that are awkward to reach through a route. Do not mirror every route test at the service level.
- **Cover features, not functions.** New route or new behavior on an existing route means a new test. A new private helper does not.
- **Write tests during coding, never after.** Every route change lands with its test in the same change.
- **Keep the exit doors in mind.** For this API the meaningful outcomes are:
  1. the HTTP response (status, body, schema), and
  2. the new database state.
     There are no queues or outbound third-party calls — do not invent tests for them.

## Web server setup

- `src/app.ts` exports the configured Express app and must never call `listen()`. Only `src/index.ts` starts the server. Keep this split — the tests import `app` directly.
- Never add a testing-only branch to production code (e.g. `if (process.env.NODE_ENV === 'test')`). No security back doors.

## Database and infrastructure

- Tests use `mongodb-memory-server` via `src/tests/helpers/db.ts`. Always go through `connectTestDb` / `disconnectTestDb` / `clearTestDb`; never spin up your own connection in a spec file.
- Standard lifecycle in every spec file:
  ```ts
  beforeAll(connectTestDb, 60000);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  ```
- Build schema state the same way production does — through the Mongoose models and `syncIndexes()` in the helper. Do not hand-create collections or indexes inside a test.

## Test anatomy

- **Small and flat.** Aim for ~7 statements per test. One interaction per test, not a whole user journey.
- **Structure by route.** Nest `describe` blocks by route, with the top level naming the resource:
  ```ts
  describe('Teams routes', () => {
    describe('POST /teams', () => {
      it('creates a team owned by the authenticated user', async () => {});
    });
  });
  ```
- **Name with `when… then…` semantics.** The `it` title states the condition and expected outcome, e.g. `'returns 403 when the caller does not own the team'`.
- **Follow AAA.** Arrange (create user/team/player), Act (one request), Assert. Separate the three with blank lines.
- **Use supertest against the imported `app`.** This is the established convention here; keep it consistent rather than introducing a second HTTP client.
- **Use real auth.** Sign a genuine token with `tokenFor(user)` and pass it as the `Authorization` header so the real auth middleware runs. For direct service calls, use `authFor(user)`. Never stub or bypass the auth middleware.
- **Assert on the response as a whole, not field by field.** Prefer one object comparison:
  ```ts
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: 'Warriors', coach: 'Coach Smith' });
  ```
  Use `toEqual` for small, fully-known payloads such as error bodies: `expect(res.body).toEqual({ error: 'Team name is required' })`.
- **Avoid snapshots.** If a payload is too big to inline, the test is covering too much.
- **Assert schema for generated fields.** Fields such as `uuid` and timestamps can't be predicted — assert their presence and type: `expect(res.body.uuid).toEqual(expect.any(String))`.
- **Assert errors from services with `rejects.toMatchObject`:**
  ```ts
  await expect(getPlayer(authFor(other), player.uuid)).rejects.toMatchObject({
    status: 403,
    message: 'You do not own this team',
  });
  ```

## Dealing with data

- **Each test creates its own records.** Build every record the test depends on inside the test using `createUser`, `createTeam`, `createPlayer`. No shared fixtures across tests, no `beforeAll` seeding of test subjects — this prevents the mystery-guest and domino effects.
- **Prefer the public API for verifying new state.** After a mutating request, read the state back through the API where a route exists. Query the model directly only for fields the API does not expose (e.g. checking `createdBy` was set from the token and not the body).
- **Test undesired side effects.** When testing delete or update, create at least two records: assert the target changed _and_ that the other one did not. Do the same for list routes — create a record owned by another user and assert it is not returned.
- **Test the authorization outcome, not just the happy path.** Every protected route needs at least: no token → 401, non-owner → 403 or 404, owner → success.
- **Randomize unique fields** when a test needs more than one record with a unique constraint; keep the value descriptive with a short random suffix rather than an opaque string.

## Mocking

- **Default to no mocks.** The in-memory database and the real service layer are fast enough. There are no external HTTP services in this codebase, so isolation mocks are almost never needed.
- **Never assert on internal mocks.** A mock that targets in-scope code _and_ appears in the assert phase is a bad mock — it produces false positives on refactor and false negatives on real bugs.
- **Simulation mocks are the one exception.** Use `jest.spyOn` only to force a scenario that cannot be triggered through the API (e.g. a database failure to exercise the error handler), and restore it in the same test.
- **Keep mocks visible.** Define them inside the test file — in the test itself if they drive the outcome, otherwise in `beforeEach`. Never in an auto-applied `__mocks__` folder or an external setup file.
- **Clean up mocks in `beforeEach`** (`jest.restoreAllMocks()`) so a file that fails to clean up cannot poison the next one.
