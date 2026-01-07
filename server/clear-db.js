// Script to clear all data from the database
// WARNING: This will delete ALL data!

import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.db');

console.log('⚠️  WARNING: This will delete ALL data from the database!');
console.log('Database path:', dbPath);

async function clearDatabase() {
  try {
    const SQL = await initSqlJs();

    if (!existsSync(dbPath)) {
      console.log('❌ Database file does not exist:', dbPath);
      process.exit(1);
    }

    // Load existing database
    const buffer = readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Delete all data (in correct order due to foreign keys)
    db.exec(`
      DELETE FROM playoff_games;
      DELETE FROM participants;
      DELETE FROM lobbies;
      DELETE FROM seasons;
      DELETE FROM admins;
    `);

    console.log('✅ Database cleared successfully!');

    // Show counts to confirm
    const getCounts = (tableName) => {
      const result = db.exec(`SELECT COUNT(*) as count FROM ${tableName}`);
      return result[0]?.values[0]?.[0] || 0;
    };

    const counts = {
      admins: getCounts('admins'),
      lobbies: getCounts('lobbies'),
      participants: getCounts('participants'),
      seasons: getCounts('seasons'),
      playoff_games: getCounts('playoff_games'),
    };

    console.log('Current counts:', counts);

    // Save the cleared database back to file
    const data = db.export();
    writeFileSync(dbPath, data);

    db.close();
    console.log('✅ Database file saved!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();
