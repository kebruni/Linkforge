// Vitest setup — populate the bare-minimum env vars so the validated `env`
// module imports cleanly under test.  Anything not set here is left to per-
// test overrides via `vi.stubEnv(...)`.
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/test";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-suite-secret-must-be-at-least-16-chars";
process.env.APP_URL = process.env.APP_URL ?? "http://localhost:3000";
