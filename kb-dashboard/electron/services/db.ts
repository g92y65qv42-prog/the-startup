import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (db) return db

  const dataDir = join(app.getPath('userData'))
  mkdirSync(dataDir, { recursive: true })

  db = new Database(join(dataDir, 'db.sqlite'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as
    | { version: number }
    | undefined
  const current = row?.version ?? 0

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          done INTEGER DEFAULT 0,
          due_date TEXT,
          pomodoro_id TEXT,
          source TEXT DEFAULT 'local',
          source_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          start TEXT NOT NULL,
          end TEXT NOT NULL,
          all_day INTEGER DEFAULT 0,
          source TEXT DEFAULT 'local',
          source_id TEXT,
          color TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE grades (
          id TEXT PRIMARY KEY,
          course TEXT NOT NULL,
          assignment TEXT NOT NULL,
          score REAL,
          max_score REAL,
          weight REAL,
          due_date TEXT,
          source TEXT DEFAULT 'local',
          source_id TEXT
        );

        CREATE TABLE pomodoro_sessions (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          state TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          started_at TEXT,
          completed_at TEXT
        );

        CREATE TABLE pomodoro_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          work_duration INTEGER DEFAULT 1500,
          short_break INTEGER DEFAULT 300,
          long_break INTEGER DEFAULT 1200,
          sessions_before_long_break INTEGER DEFAULT 4
        );
        INSERT OR IGNORE INTO pomodoro_config (id) VALUES (1);

        CREATE TABLE transcriptions (
          id TEXT PRIMARY KEY,
          title TEXT,
          audio_path TEXT,
          transcript TEXT,
          duration_seconds INTEGER,
          created_at TEXT NOT NULL
        );

        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          panel_visibility TEXT NOT NULL DEFAULT '{}',
          panel_layouts TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE news_items (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          summary TEXT,
          url TEXT,
          source TEXT,
          published_at TEXT,
          fetched_at TEXT NOT NULL
        );
      `
    },
    {
      version: 2,
      sql: `
        CREATE TABLE news_feeds (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,
          label TEXT,
          enabled INTEGER DEFAULT 1,
          created_at TEXT NOT NULL
        );
      `
    }
  ]

  for (const migration of migrations) {
    if (migration.version > current) {
      db.exec(migration.sql)
      db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(migration.version)
    }
  }
}
