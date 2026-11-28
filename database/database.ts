import * as SQLite from "expo-sqlite";

import { CREATE_TABLES_SQL, DATABASE_NAME, DATABASE_VERSION, POST_SERVICE_RECORDS_COLUMNS_SQL } from "./tables";

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
  2: migrateToVersion2,
  3: rebuildPostServiceRecordsIfOutdated,
  4: addNotificationProfileField,
  5: migrateToVersion5,
};

/**
 * Spec bms/0022: post_service_records gets syncBlocked, lastError and baseVersion (rebuilt from
 * POST_SERVICE_RECORDS_COLUMNS_SQL, keeping its rows), and job_orders gets postServiceLocked.
 */
async function migrateToVersion5(db: SQLite.SQLiteDatabase): Promise<void> {
  await rebuildPostServiceRecordsIfOutdated(db);
  const jobOrderColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(job_orders)");
  if (!jobOrderColumns.some((column) => column.name === "postServiceLocked")) {
    await db.execAsync(
      "ALTER TABLE job_orders ADD COLUMN postServiceLocked INTEGER NOT NULL DEFAULT 0 CHECK (postServiceLocked IN (0, 1))",
    );
  }
}

/** Adds notifications.profileField (which profile field an account notification opens). */
async function addNotificationProfileField(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(notifications)");
  if (!columns.some((c) => c.name === "profileField")) {
    await db.execAsync("ALTER TABLE notifications ADD COLUMN profileField TEXT");
  }
}

/**
 * Adds job_orders.downPayment and allows 'XENDIT' as an add-ons payment.
 * New installs already get both from CREATE_TABLES_SQL in version 1, so each step checks first.
 */
async function migrateToVersion2(db: SQLite.SQLiteDatabase): Promise<void> {
  const jobOrderColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(job_orders)");
  if (!jobOrderColumns.some((column) => column.name === "downPayment")) {
    await db.execAsync("ALTER TABLE job_orders ADD COLUMN downPayment REAL NOT NULL DEFAULT 0 CHECK (downPayment >= 0)");
  }
  await rebuildPostServiceRecordsIfOutdated(db);
}

/**
 * SQLite cannot change a CHECK constraint in place, so when post_service_records was created with
 * older column definitions it is rebuilt from POST_SERVICE_RECORDS_COLUMNS_SQL, keeping its rows.
 */
async function rebuildPostServiceRecordsIfOutdated(db: SQLite.SQLiteDatabase): Promise<void> {
  const postService = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'post_service_records'",
  );
  if (postService && !postService.sql.includes(POST_SERVICE_RECORDS_COLUMNS_SQL)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`CREATE TABLE post_service_records_v2 (${POST_SERVICE_RECORDS_COLUMNS_SQL})`);
      await db.execAsync(
        `INSERT INTO post_service_records_v2
          (jobOrderId, serviceCompleted, arrivalTime, addOnKeys, paymentMethod, addOnPayment,
           completionNotes, issueReported, issueDetails, submittedAt, syncPending)
         SELECT jobOrderId, serviceCompleted, arrivalTime, addOnKeys, paymentMethod, addOnPayment,
           completionNotes, issueReported, issueDetails, submittedAt, syncPending
         FROM post_service_records`,
      );
      await db.execAsync("DROP TABLE post_service_records");
      await db.execAsync("ALTER TABLE post_service_records_v2 RENAME TO post_service_records");
      await db.execAsync("CREATE INDEX IF NOT EXISTS idx_post_service_syncPending ON post_service_records(syncPending)");
    });
  }
}

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
