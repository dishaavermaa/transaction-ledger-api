import { existsSync } from 'node:fs';

/**
 * Side-effect module: loads a .env file into process.env before any config is
 * read. Imported first by the server entrypoint. In production, where real
 * environment variables are injected, the file is simply absent and skipped.
 *
 * The file path can be overridden with ENV_FILE (used by the test setup).
 */
const envFile = process.env.ENV_FILE ?? '.env';
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
