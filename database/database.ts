import * as SQLite from "expo-sqlite";

import { CREATE_TABLES_SQL, DATABASE_NAME, DATABASE_VERSION } from "./tables";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  try {
    return await SQLite.openDatabaseAsync(DATABASE_NAME);
  } catch (error) {
    console.warn("[SQLite] openDatabaseAsync failed, falling back to openDatabaseSync", error);
    return SQLite.openDatabaseSync(DATABASE_NAME);
  }
}

async function execSqlStatements(db: SQLite.SQLiteDatabase, sql: string): Promise<void> {
  const statements = sql
    .split(/;\s*/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.execAsync(statement);
  }
}

/** Opens bms_mobile.db once and creates/upgrades its tables. Safe to call many times. */
export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase().then(async (database) => {
      await database.execAsync("PRAGMA journal_mode = WAL");
      await database.execAsync("PRAGMA foreign_keys = ON");
      await createTables(database);
      return database;
    });
  }

  try {
    return await databasePromise;
  } catch (error) {
    databasePromise = null;
    console.error("[SQLite] Database initialization failed", error);
    throw new Error(`Unable to initialize ${DATABASE_NAME}: ${getErrorMessage(error)}`);
  }
}

/**
 * Schema upgrades, keyed by the version they upgrade to. When a table changes:
 * bump DATABASE_VERSION in tables.ts, update CREATE_TABLES_SQL for new installs,
 * and add a migration here for phones that already have the old schema.
 */
const MIGRATIONS: Record<number, (db: SQLite.SQLiteDatabase) => Promise<void>> = {
  1: (db) => execSqlStatements(db, CREATE_TABLES_SQL),
};

export async function createTables(database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = database ?? (await openDatabase());

  try {
    const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const currentVersion = versionRow?.user_version ?? 0;

    if (currentVersion > DATABASE_VERSION) {
      console.warn(
        `[SQLite] Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}; continuing with existing schema`,
      );
      return;
    }

    for (let version = currentVersion + 1; version <= DATABASE_VERSION; version++) {
      await MIGRATIONS[version]?.(db);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    }
  } catch (error) {
    console.error("[SQLite] Table creation failed", error);
    throw new Error(`Unable to create local tables: ${getErrorMessage(error)}`);
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return initializeDatabase();
}

/** Deletes every locally stored row (the tables themselves are kept). */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();

  try {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync("DELETE FROM notifications");
      await transaction.runAsync("DELETE FROM leave_requests");
      await transaction.runAsync("DELETE FROM weekly_availability");
      await transaction.runAsync("DELETE FROM post_service_records");
      await transaction.runAsync("DELETE FROM job_orders");
      await transaction.runAsync("DELETE FROM sync_metadata");
    });
  } catch (error) {
    console.error("[SQLite] Clear database failed", error);
    throw new Error(`Unable to clear local data: ${getErrorMessage(error)}`);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
