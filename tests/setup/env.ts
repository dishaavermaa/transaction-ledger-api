import { existsSync } from 'node:fs';

// Point configuration at the test database before any app module is imported.
// Runs once per test file, before that file (and the Prisma client singleton
// it imports) is evaluated.
const envFile = process.env.ENV_FILE ?? '.env.test';
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
