const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, 'wordbook.db')
const db = new Database(dbPath)

console.log('Starting reading progress migration...')

try {
  // Begin transaction
  db.exec('BEGIN TRANSACTION')
  
  // Find and remove duplicate reading progress records, keeping only the most recent
  const duplicates = db.prepare(`
    SELECT file_id, COUNT(*) as count 
    FROM reading_progress 
    GROUP BY file_id 
    HAVING COUNT(*) > 1
  `).all()
  
  console.log(`Found ${duplicates.length} files with duplicate progress records`)
  
  for (const duplicate of duplicates) {
    console.log(`Cleaning up duplicates for file_id: ${duplicate.file_id}`)
    
    // Keep only the most recent record for each file_id
    db.prepare(`
      DELETE FROM reading_progress 
      WHERE file_id = ? AND id NOT IN (
        SELECT id FROM reading_progress 
        WHERE file_id = ? 
        ORDER BY last_read_at DESC 
        LIMIT 1
      )
    `).run(duplicate.file_id, duplicate.file_id)
  }
  
  // Add the UNIQUE constraint to file_id (this will recreate the table)
  console.log('Adding UNIQUE constraint to file_id...')
  
  // Create temporary table with the new schema
  db.exec(`
    CREATE TABLE reading_progress_new (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL UNIQUE,
      location TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      last_read_at INTEGER NOT NULL,
      FOREIGN KEY(file_id) REFERENCES epub_files(id) ON DELETE CASCADE
    )
  `)
  
  // Copy data from old table to new table
  db.exec(`
    INSERT INTO reading_progress_new (id, file_id, location, progress, last_read_at)
    SELECT id, file_id, location, progress, last_read_at
    FROM reading_progress
  `)
  
  // Drop old table and rename new table
  db.exec('DROP TABLE reading_progress')
  db.exec('ALTER TABLE reading_progress_new RENAME TO reading_progress')
  
  // Commit transaction
  db.exec('COMMIT')
  
  console.log('Migration completed successfully!')
  
  // Verify the result
  const remainingCount = db.prepare('SELECT COUNT(*) as count FROM reading_progress').get()
  console.log(`Total reading progress records after migration: ${remainingCount.count}`)
  
} catch (error) {
  console.error('Migration failed:', error)
  db.exec('ROLLBACK')
  throw error
} finally {
  db.close()
}