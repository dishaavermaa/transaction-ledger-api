import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every test file shares one Postgres database, so running files in parallel
    // would let them truncate each other's rows mid-test. One worker keeps the
    // suite deterministic. (Requests *within* a test still run concurrently —
    // that's what the concurrency tests exercise.)
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    // Keep the test server quiet. Set here (not only in .env.test) because
    // process.loadEnvFile does not override a variable the worker already has.
    env: { LOG_LEVEL: 'silent' },
    setupFiles: ['tests/setup/env.ts'],
    globalSetup: ['tests/setup/global.ts'],
    // Concurrency tests fire up to 100 requests and can take a few seconds.
    hookTimeout: 60_000,
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entrypoint-only startup glue: wires things together, loads the env file,
      // and starts listening. Exercised by running the server, not by unit tests.
      exclude: ['src/server.ts', 'src/config/bootstrap-env.ts'],
      reporter: ['text', 'html'],
    },
  },
});
