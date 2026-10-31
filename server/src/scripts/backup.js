import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');

export async function createDatabaseBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(BACKUP_DIR, `muqecha_standup_backup_${timestamp}.sql`);
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

  try {
    const tables = ['user', 'session', 'account', 'verification', 'meeting', 'meeting_record'];
    let dumpContent = `-- MUQECHA STUDIOS DATABASE BACKUP\n-- Generated: ${new Date().toISOString()}\n-- Database: muqecha_standup\n\n`;

    const summary = {};

    for (const table of tables) {
      const res = await pool.query(`SELECT * FROM "${table}"`);
      summary[table] = res.rows.length;

      dumpContent += `-- Table: ${table} (${res.rows.length} rows)\n`;
      if (res.rows.length > 0) {
        const columns = Object.keys(res.rows[0]);
        const colsFormatted = columns.map(c => `"${c}"`).join(', ');

        for (const row of res.rows) {
          const values = columns.map(c => {
            const val = row[c];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            // Escape single quotes for SQL string literals
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');

          dumpContent += `INSERT INTO "${table}" (${colsFormatted}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
        }
      }
      dumpContent += '\n';
    }

    fs.writeFileSync(backupFilePath, dumpContent, 'utf8');

    const fileStats = fs.statSync(backupFilePath);
    if (!fileStats || fileStats.size === 0) {
      throw new Error('Backup file was created but has 0 bytes.');
    }

    console.log('[BACKUP SUCCESS]');
    console.log(`- Backup file: ${backupFilePath}`);
    console.log(`- File size: ${(fileStats.size / 1024).toFixed(2)} KB`);
    console.log('- Record counts archived:');
    for (const [tbl, count] of Object.entries(summary)) {
      console.log(`    • ${tbl}: ${count} rows`);
    }

    return { success: true, path: backupFilePath, size: fileStats.size, summary };
  } catch (err) {
    console.error('[BACKUP FAILED]:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
  createDatabaseBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

