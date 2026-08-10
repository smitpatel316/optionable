// Bun-compatible DB layer mimicking better-sqlite3 API
import { Database as BunDatabase } from "bun:sqlite";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

const DATA_DIR = process.env.DATA_DIR || "./data";
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export const dbPath = join(DATA_DIR, "optionable.db");

// Bun's Database - create:true is default
export const db = new BunDatabase(dbPath, { create: true });

// Emulate better-sqlite3 pragma using exec/query
db.pragma = (stmt, options) => {
  try {
    // pragma can be 'journal_mode = WAL' or 'foreign_keys = ON' etc.
    const sql = stmt.trim().endsWith(";") ? stmt : `PRAGMA ${stmt}`;
    // For pragma that returns value (e.g. journal_mode), using query
    if (!stmt.includes("=")) {
      // reading pragma, return first column?
      try {
        const row = db.query(sql).get();
        if (row) return Object.values(row)[0];
        return undefined;
      } catch {
        // fallback exec
        db.exec(sql);
        return undefined;
      }
    }
    db.exec(sql);
  } catch (e) {
    // ignore pragma errors for WAL mode etc.
    console.warn("pragma warn", stmt, e.message);
  }
};

// Ensure close matches
// Bun's Database has close method already

// Initial pragmas matching original file
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");
