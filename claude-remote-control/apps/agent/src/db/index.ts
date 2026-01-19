import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { CREATE_TABLES_SQL, SCHEMA_VERSION, RETENTION_CONFIG, MIGRATION_16 } from './schema.js';
import type { DbSchemaVersion } from './schema.js';

// Database file location: ~/.247/data/agent.db
const DATA_DIR = resolve(process.env.HOME || '~', '.247', 'data');
const DB_PATH = join(DATA_DIR, 'agent.db');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get or create the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Initialize the database
 * - Creates data directory if missing
 * - Opens/creates database file
 * - Runs migrations
 * - Sets WAL mode for better performance
 */
export function initDatabase(dbPath?: string): Database.Database {
  const path = dbPath ?? DB_PATH;

  // Create data directory if it doesn't exist
  const dataDir = dirname(path);
  if (!existsSync(dataDir)) {
    console.log(`[DB] Creating data directory: ${dataDir}`);
    mkdirSync(dataDir, { recursive: true });
  }

  // Open database (creates if doesn't exist)
  console.log(`[DB] Opening database: ${path}`);
  db = new Database(path);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Create an in-memory database for testing
 */
export function initTestDatabase(): Database.Database {
  db = new Database(':memory:');
  runMigrations(db);
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    console.log('[DB] Closing database connection');
    db.close();
    db = null;
  }
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  const currentVersion = getCurrentSchemaVersion(database);

  if (currentVersion < SCHEMA_VERSION) {
    console.log(`[DB] Running migrations from v${currentVersion} to v${SCHEMA_VERSION}`);

    // For fresh databases, just run the simplified schema
    if (currentVersion === 0) {
      database.exec(CREATE_TABLES_SQL);
    } else {
      // For existing databases, run migrations in order
      if (currentVersion < 15) {
        migrateToV15(database);
      }
      if (currentVersion < 16) {
        migrateToV16(database);
      }
      if (currentVersion < 17) {
        migrateToV17(database);
      }
    }

    // Record the new version
    database
      .prepare(
        `
      INSERT OR REPLACE INTO schema_version (version, applied_at)
      VALUES (?, ?)
    `
      )
      .run(SCHEMA_VERSION, Date.now());

    console.log(`[DB] Migrations complete. Now at v${SCHEMA_VERSION}`);
  } else {
    console.log(`[DB] Database schema is up to date (v${currentVersion})`);
  }
}

/**
 * Migration to v15: Simplification - remove unused columns and tables
 * SQLite doesn't support dropping columns easily, so we recreate the sessions table
 */
function migrateToV15(database: Database.Database): void {
  console.log('[DB] v15 migration: Simplifying schema');

  // Drop status_history table if it exists
  const historyTableExists = database
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='status_history'`)
    .get();

  if (historyTableExists) {
    console.log('[DB] v15 migration: Dropping status_history table');
    database.exec('DROP TABLE IF EXISTS status_history');
  }

  // Check if sessions table has the old columns we want to remove
  const columns = database.pragma('table_info(sessions)') as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  // If we have old columns like model, cost_usd, worktree_path, etc., recreate the table
  const hasOldColumns =
    columnNames.has('model') ||
    columnNames.has('cost_usd') ||
    columnNames.has('worktree_path') ||
    columnNames.has('spawn_prompt');

  if (hasOldColumns) {
    console.log('[DB] v15 migration: Recreating sessions table with simplified schema');

    // Create new simplified sessions table
    database.exec(`
      CREATE TABLE IF NOT EXISTS sessions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        project TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'init',
        attention_reason TEXT,
        last_event TEXT,
        last_activity INTEGER NOT NULL,
        last_status_change INTEGER NOT NULL,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Copy data from old table to new table (only the columns we're keeping)
    database.exec(`
      INSERT INTO sessions_new (name, project, status, attention_reason, last_event,
                                last_activity, last_status_change, archived_at, created_at, updated_at)
      SELECT name, project, status, attention_reason, last_event,
             last_activity, last_status_change, archived_at, created_at, updated_at
      FROM sessions;
    `);

    // Drop old table and rename new one
    database.exec('DROP TABLE sessions');
    database.exec('ALTER TABLE sessions_new RENAME TO sessions');

    // Recreate indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)');
    database.exec(
      'CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity)'
    );

    console.log('[DB] v15 migration: Sessions table simplified');
  }

  // Ensure schema_version table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  console.log('[DB] v15 migration: Simplification complete');
}

/**
 * Migration to v16: Remove status tracking
 * Remove status, attention_reason, and last_status_change columns
 */
function migrateToV16(database: Database.Database): void {
  console.log('[DB] v16 migration: Removing status tracking');

  // Check if sessions table has the status columns we want to remove
  const columns = database.pragma('table_info(sessions)') as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  const hasStatusColumns =
    columnNames.has('status') ||
    columnNames.has('attention_reason') ||
    columnNames.has('last_status_change');

  if (hasStatusColumns) {
    console.log('[DB] v16 migration: Recreating sessions table without status columns');
    database.exec(MIGRATION_16);
    console.log('[DB] v16 migration: Sessions table updated');
  }

  console.log('[DB] v16 migration: Status tracking removed');
}

/**
 * Migration to v17: Add status tracking via hooks
 * Adds status, status_source, attention_reason, and last_status_change columns
 */
function migrateToV17(database: Database.Database): void {
  console.log('[DB] v17 migration: Adding status tracking via hooks');

  // Helper to get current columns
  const getColumnNames = (): Set<string> => {
    const columns = database.pragma('table_info(sessions)') as Array<{ name: string }>;
    return new Set(columns.map((c) => c.name));
  };

  const requiredColumns = ['status', 'status_source', 'attention_reason', 'last_status_change'];
  let columnNames = getColumnNames();

  // Add each missing column
  for (const col of requiredColumns) {
    if (!columnNames.has(col)) {
      console.log(`[DB] v17 migration: Adding column ${col}`);
      try {
        database.exec(
          `ALTER TABLE sessions ADD COLUMN ${col} ${col === 'last_status_change' ? 'INTEGER' : 'TEXT'}`
        );
      } catch {
        // Column might already exist from a failed partial migration
        console.log(`[DB] v17 migration: Column ${col} might already exist, continuing...`);
      }
    }
  }

  // Verify all columns were added
  columnNames = getColumnNames();
  const missingColumns = requiredColumns.filter((col) => !columnNames.has(col));
  if (missingColumns.length > 0) {
    throw new Error(`[DB] v17 migration failed: Missing columns: ${missingColumns.join(', ')}`);
  }

  // Create index if it doesn't exist
  database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)');

  console.log('[DB] v17 migration: Complete');
}

/**
 * Get current schema version
 */
function getCurrentSchemaVersion(database: Database.Database): number {
  try {
    // Check if schema_version table exists
    const tableExists = database
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='schema_version'
    `
      )
      .get();

    if (!tableExists) {
      return 0;
    }

    const row = database
      .prepare(
        `
      SELECT version FROM schema_version ORDER BY version DESC LIMIT 1
    `
      )
      .get() as DbSchemaVersion | undefined;

    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Get database statistics for debugging
 */
export function getDatabaseStats(): {
  sessions: number;
} {
  const database = getDatabase();

  const sessions = database.prepare('SELECT COUNT(*) as count FROM sessions').get() as {
    count: number;
  };

  return {
    sessions: sessions.count,
  };
}

// Export retention config for use in cleanup
export { RETENTION_CONFIG };
