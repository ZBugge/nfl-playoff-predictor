import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../database.db');

let db: SqlJsDatabase;

async function initDb() {
  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    writeFileSync(dbPath, data);
  }
}

export let dbPromise = initDb();

export async function getDb(): Promise<SqlJsDatabase> {
  return dbPromise;
}

export async function initializeDatabase() {
  const database = await getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_super_admin BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      max_admins INTEGER NOT NULL DEFAULT 100,
      max_lobbies_per_admin INTEGER NOT NULL DEFAULT 10,
      max_participants_per_lobby INTEGER NOT NULL DEFAULT 50,
      max_active_seasons INTEGER NOT NULL DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO system_config (id, max_admins, max_lobbies_per_admin, max_participants_per_lobby, max_active_seasons)
    VALUES (1, 100, 10, 50, 5);

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      year INTEGER NOT NULL,
      sport TEXT NOT NULL DEFAULT 'NFL',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      round TEXT NOT NULL,
      game_number INTEGER NOT NULL,
      team_home TEXT NOT NULL,
      team_away TEXT NOT NULL,
      seed_home INTEGER,
      seed_away INTEGER,
      winner TEXT,
      espn_event_id TEXT,
      completed BOOLEAN DEFAULT 0,
      is_actual_matchup BOOLEAN DEFAULT 1,
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      UNIQUE(season_id, round, game_number)
    );

    CREATE TABLE IF NOT EXISTS playoff_seeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      conference TEXT NOT NULL,
      seed INTEGER NOT NULL,
      team_abbr TEXT NOT NULL,
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      UNIQUE(season_id, conference, seed)
    );

    CREATE TABLE IF NOT EXISTS lobbies (
      id TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      scoring_type TEXT NOT NULL DEFAULT 'simple',
      status TEXT NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id),
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lobby_id TEXT NOT NULL,
      name TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
      UNIQUE(lobby_id, name)
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      predicted_winner TEXT NOT NULL,
      predicted_opponent TEXT,
      FOREIGN KEY (participant_id) REFERENCES participants(id),
      FOREIGN KEY (game_id) REFERENCES games(id),
      UNIQUE(participant_id, game_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lobbies_admin ON lobbies(admin_id);
    CREATE INDEX IF NOT EXISTS idx_lobbies_season ON lobbies(season_id);
    CREATE INDEX IF NOT EXISTS idx_games_season ON games(season_id);
    CREATE INDEX IF NOT EXISTS idx_participants_lobby ON participants(lobby_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_participant ON predictions(participant_id);
  `);

  saveDb();
}

export async function runQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const database = await getDb();
  const stmt = database.prepare(query);
  stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  saveDb();

  return results;
}

export async function runExec(query: string, params: any[] = []): Promise<void> {
  const database = await getDb();
  const stmt = database.prepare(query);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDb();
}

export async function runInsert(query: string, params: any[] = []): Promise<number> {
  const database = await getDb();
  const stmt = database.prepare(query);
  stmt.bind(params);
  stmt.step();
  stmt.free();

  const result = await runQuery<{ last_insert_rowid: number }>('SELECT last_insert_rowid() as last_insert_rowid');
  saveDb();

  return result[0].last_insert_rowid;
}

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  is_super_admin: boolean;
  created_at: string;
}

export interface Season {
  id: number;
  name: string;
  year: number;
  sport: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface PlayoffSeed {
  id: number;
  season_id: number;
  conference: 'AFC' | 'NFC';
  seed: number;
  team_abbr: string;
}

export interface Game {
  id: number;
  season_id: number;
  round: 'wild_card' | 'divisional' | 'conference' | 'super_bowl';
  game_number: number;
  team_home: string;
  team_away: string;
  seed_home: number | null;
  seed_away: number | null;
  winner: string | null;
  espn_event_id: string | null;
  completed: boolean;
  is_actual_matchup: boolean;
}

export interface Lobby {
  id: string;
  admin_id: number;
  season_id: number;
  name: string;
  scoring_type: 'simple' | 'weighted' | 'bracket' | 'both';
  status: 'open' | 'in_progress' | 'completed';
  created_at: string;
}

export interface Participant {
  id: number;
  lobby_id: string;
  name: string;
  submitted_at: string;
}

export interface Prediction {
  id: number;
  participant_id: number;
  game_id: number;
  predicted_winner: string;
  predicted_opponent: string | null;
}

export interface SystemConfig {
  id: number;
  max_admins: number;
  max_lobbies_per_admin: number;
  max_participants_per_lobby: number;
  max_active_seasons: number;
  updated_at: string;
}
