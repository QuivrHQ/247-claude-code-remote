import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CREATE_TABLES_SQL, SCHEMA_VERSION, RETENTION_CONFIG } from './schema.js';
import type { DbSchemaVersion } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file location: apps/agent/data/agent.db
const DATA_DIR = join(__dirname, '..', '..', 'data');
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

    // Run all schema creation (idempotent with IF NOT EXISTS)
    database.exec(CREATE_TABLES_SQL);

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
 * Migrate environments from JSON file to database
 * Only runs if environments.json exists and environments table is empty
 */
export function migrateEnvironmentsFromJson(database: Database.Database): boolean {
  const ENVIRONMENTS_FILE = join(__dirname, '..', '..', 'environments.json');

  // Check if JSON file exists
  if (!existsSync(ENVIRONMENTS_FILE)) {
    console.log('[DB] No environments.json found, skipping migration');
    return false;
  }

  // Check if environments table is empty
  const count = database.prepare('SELECT COUNT(*) as count FROM environments').get() as {
    count: number;
  };

  if (count.count > 0) {
    console.log('[DB] Environments table already has data, skipping migration');
    return false;
  }

  try {
    console.log('[DB] Migrating environments from JSON...');
    const data = readFileSync(ENVIRONMENTS_FILE, 'utf-8');
    const environments = JSON.parse(data) as Array<{
      id: string;
      name: string;
      provider: string;
      isDefault: boolean;
      variables: Record<string, string>;
      createdAt: number;
      updatedAt: number;
    }>;

    const insert = database.prepare(`
      INSERT INTO environments (id, name, provider, is_default, variables, created_at, updated_at)
      VALUES (@id, @name, @provider, @isDefault, @variables, @createdAt, @updatedAt)
    `);

    const insertMany = database.transaction((envs: typeof environments) => {
      for (const env of envs) {
        insert.run({
          id: env.id,
          name: env.name,
          provider: env.provider,
          isDefault: env.isDefault ? 1 : 0,
          variables: JSON.stringify(env.variables),
          createdAt: env.createdAt,
          updatedAt: env.updatedAt,
        });
      }
    });

    insertMany(environments);
    console.log(`[DB] Migrated ${environments.length} environments from JSON`);
    return true;
  } catch (err) {
    console.error('[DB] Failed to migrate environments from JSON:', err);
    return false;
  }
}

/**
 * Get database statistics for debugging
 */
export function getDatabaseStats(): {
  sessions: number;
  history: number;
  environments: number;
} {
  const database = getDatabase();

  const sessions = database.prepare('SELECT COUNT(*) as count FROM sessions').get() as {
    count: number;
  };
  const history = database.prepare('SELECT COUNT(*) as count FROM status_history').get() as {
    count: number;
  };
  const environments = database.prepare('SELECT COUNT(*) as count FROM environments').get() as {
    count: number;
  };

  return {
    sessions: sessions.count,
    history: history.count,
    environments: environments.count,
  };
}

// Export retention config for use in cleanup
export { RETENTION_CONFIG };
