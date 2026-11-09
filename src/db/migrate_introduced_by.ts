import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('--- Adding introduced_by column to borrowers table ---');
    const result = await pool.query(`
      ALTER TABLE borrowers
      ADD COLUMN IF NOT EXISTS introduced_by VARCHAR(255);
    `);
    console.log('Migration executed successfully:', result.command);

    // Verify column exists
    const check = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'borrowers' AND column_name = 'introduced_by';
    `);
    console.log('Column check result:', check.rows);
  } catch (error: any) {
    console.error('Migration error:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();

