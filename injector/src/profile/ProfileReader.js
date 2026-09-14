/**
 * FWYS — ProfileReader
 * Reads profile data from SQLite database (shared with Qt UI).
 */

'use strict';

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(process.cwd(), '..', 'profiles', 'profiles.db');

// sql.js: pure WebAssembly SQLite — no native compilation needed
let _sqlJs = null;
async function getSqlJs() {
  if (_sqlJs) return _sqlJs;
  const initSqlJs = require('sql.js');
  _sqlJs = await initSqlJs();
  return _sqlJs;
}

function loadDBSync() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const initSqlJs = require('sql.js');
    // Synchronous workaround for startup — load WASM sync via pre-built binary
    const SQL = initSqlJs.SqlJs || require('sql.js/dist/sql-wasm.js');
    const filebuffer = fs.readFileSync(DB_PATH);
    return { filebuffer, ready: false };
  } catch (e) {
    return null;
  }
}

class ProfileReader {
  /**
   * Load a profile by ID from SQLite.
   * @param {string} profileId
   * @returns {object} profile object
   */
  static load(profileId) {
    try {
      const database = getDB();
      const row = database.prepare(
        'SELECT * FROM profiles WHERE id = ? LIMIT 1'
      ).get(profileId);

      if (!row) {
        throw new Error(`Profile not found: ${profileId}`);
      }

      // Parse JSON fields
      const profile = {
        id: row.id,
        name: row.name,
        proxy: row.proxy || null,
        proxy_type: row.proxy_type || 'http',
        created_at: row.created_at,
        fingerprint_overrides: row.fingerprint_overrides
          ? JSON.parse(row.fingerprint_overrides)
          : {},
      };

      return profile;
    } catch (e) {
      // Fallback: return minimal profile if DB not available
      console.warn(`  [ProfileReader] DB error: ${e.message}. Using fallback.`);
      return {
        id: profileId,
        name: 'Unknown',
        proxy: null,
        proxy_type: 'http',
        fingerprint_overrides: {},
      };
    }
  }

  /**
   * List all profiles.
   * @returns {Array}
   */
  static listAll() {
    const database = getDB();
    return database.prepare('SELECT id, name, proxy, created_at FROM profiles ORDER BY created_at DESC').all();
  }

  static selfTest() {
    // Just check module loads correctly
    if (typeof ProfileReader.load !== 'function')
      throw new Error('ProfileReader.load not a function');
  }
}

module.exports = ProfileReader;
