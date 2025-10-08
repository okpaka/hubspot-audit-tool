const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'hubspot-audit.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Questions table
    db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section TEXT NOT NULL,
        question TEXT NOT NULL,
        max_score INTEGER DEFAULT 2
    )`);

    // Enhanced Audits table for lead capture
    db.run(`CREATE TABLE IF NOT EXISTS audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        company TEXT,
        overall_score INTEGER,
        total_achieved INTEGER,
        total_possible INTEGER,
        section_scores TEXT,
        answers TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        contact_id TEXT,
        lead_source TEXT DEFAULT 'hubspot-audit-tool'
    )`);
});

module.exports = db;