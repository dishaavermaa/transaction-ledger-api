import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

/** Returns the same connection URL but pointing at a different database name. */
function urlWithDatabase(raw: string, database: string): string {
  const url = new URL(raw);
  url.pathname = `/${database}`;
  return url.toString();
}

function databaseName(raw: string): string {
  return new URL(raw).pathname.replace(/^\//, '');
}

/**
 * Runs once before the whole suite. Creates the test database if it isn't there
 * yet (connecting to the default `postgres` database to do it), then applies all
 * migrations with `prisma migrate deploy` so tests run against the real schema.
 */
export default async function globalSetup(): Promise<void> {
  const envFile = process.env.ENV_FILE ?? '.env.test';
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) throw new Error('DATABASE_URL is not set for tests (check .env.test).');

  const dbName = databaseName(testUrl);
  const admin = new PrismaClient({
    datasources: { db: { url: urlWithDatabase(testUrl, 'postgres') } },
  });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } catch (error) {
    // 42P04 = database already exists, which is the normal case on reruns.
    if (!/already exists|42P04/i.test(String(error))) {
      // eslint-disable-next-line no-console
      console.warn(`Could not create test database "${dbName}":`, error);
    }
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
