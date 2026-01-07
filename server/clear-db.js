// Script to clear all data from the database
// WARNING: This will delete ALL data!

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.db');
const db = new Database(dbPath);

console.log('⚠️  WARNING: This will delete ALL data from the database!');
console.log('Database path:', dbPath);

try {
  db.exec(`
    DELETE FROM playoff_games;
    DELETE FROM participants;
    DELETE FROM lobbies;
    DELETE FROM seasons;
    DELETE FROM admins;
  `);

  console.log('✅ Database cleared successfully!');

  // Show counts to confirm
  const counts = {
    admins: db.prepare('SELECT COUNT(*) as count FROM admins').get().count,
    lobbies: db.prepare('SELECT COUNT(*) as count FROM lobbies').get().count,
    participants: db.prepare('SELECT COUNT(*) as count FROM participants').get().count,
    seasons: db.prepare('SELECT COUNT(*) as count FROM seasons').get().count,
    playoff_games: db.prepare('SELECT COUNT(*) as count FROM playoff_games').get().count,
  };

  console.log('Current counts:', counts);
} catch (error) {
  console.error('❌ Error clearing database:', error);
  process.exit(1);
} finally {
  db.close();
}
