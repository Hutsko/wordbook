const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')
const multer = require('multer')
const fs = require('fs')
const crypto = require('crypto')
const extract = require('extract-zip')

const app = express()
app.use(cors())
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // Use original filename with timestamp to avoid conflicts
    const timestamp = Date.now()
    const originalName = file.originalname
    cb(null, `${timestamp}_${originalName}`)
  }
})

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only allow EPUB files
    if (file.mimetype === 'application/epub+zip' || file.originalname.endsWith('.epub')) {
      cb(null, true)
    } else {
      cb(new Error('Only EPUB files are allowed'), false)
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
})

const dbPath = path.join(__dirname, 'wordbook.db')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS word_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(group_id) REFERENCES word_groups(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  term TEXT NOT NULL,
  transcription TEXT,
  definition TEXT,
  strength INTEGER NOT NULL DEFAULT 0,
  frequency INTEGER NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY,
  word_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS custom_phrases (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS epub_files (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(group_id) REFERENCES word_groups(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reading_progress (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  last_read_at INTEGER NOT NULL,
  FOREIGN KEY(file_id) REFERENCES epub_files(id) ON DELETE CASCADE
);
`)

// Word Groups
app.get('/api/word-groups', (req, res) => {
  const rows = db.prepare(`
    SELECT g.id, g.name, g.created_at as createdAt,
           (SELECT COUNT(1) FROM lists l WHERE l.group_id = g.id) as listsCount
    FROM word_groups g ORDER BY g.created_at DESC
  `).all()
  res.json(rows)
})

app.post('/api/word-groups', (req, res) => {
  const { id, name, createdAt } = req.body
  db.prepare('INSERT INTO word_groups (id, name, created_at) VALUES (?, ?, ?)').run(id, name, createdAt)
  res.status(201).json({ ok: true })
})

app.patch('/api/word-groups/:id', (req, res) => {
  const { name } = req.body
  db.prepare('UPDATE word_groups SET name = ? WHERE id = ?').run(name, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/word-groups/:id', (req, res) => {
  db.prepare('DELETE FROM word_groups WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Lists
app.get('/api/lists', (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.name, l.group_id as groupId, l.created_at as createdAt,
           (SELECT COUNT(1) FROM words w WHERE w.list_id = l.id) as wordsCount
    FROM lists l ORDER BY l.created_at DESC
  `).all()
  res.json(rows)
})

app.post('/api/lists', (req, res) => {
  const { id, name, groupId, createdAt } = req.body
  db.prepare('INSERT INTO lists (id, name, group_id, created_at) VALUES (?, ?, ?, ?)').run(id, name, groupId || null, createdAt)
  res.status(201).json({ ok: true })
})

app.patch('/api/lists/:id', (req, res) => {
  const { name, groupId } = req.body
  if (name !== undefined && groupId !== undefined) {
    db.prepare('UPDATE lists SET name = ?, group_id = ? WHERE id = ?').run(name, groupId, req.params.id)
  } else if (name !== undefined) {
    db.prepare('UPDATE lists SET name = ? WHERE id = ?').run(name, req.params.id)
  } else if (groupId !== undefined) {
    db.prepare('UPDATE lists SET group_id = ? WHERE id = ?').run(groupId, req.params.id)
  }
  res.json({ ok: true })
})

app.delete('/api/lists/:id', (req, res) => {
  db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Words
app.get('/api/lists/:listId/words', (req, res) => {
  const rows = db.prepare('SELECT id, term, transcription, definition, strength, created_at as createdAt FROM words WHERE list_id = ? ORDER BY created_at DESC').all(req.params.listId)
  res.json(rows)
})

app.post('/api/lists/:listId/words', (req, res) => {
  const { id, term, transcription, definition, strength = 0, createdAt } = req.body
  db.prepare('INSERT INTO words (id, list_id, term, transcription, definition, strength, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.listId, term, transcription, definition, strength, createdAt)
  res.status(201).json({ ok: true })
})

app.patch('/api/words/:id', (req, res) => {
  const { term, transcription, definition, strength } = req.body
  db.prepare('UPDATE words SET term = ?, transcription = ?, definition = ?, strength = COALESCE(?, strength) WHERE id = ?')
    .run(term, transcription, definition, strength ?? null, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/words/:id', (req, res) => {
  db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Sentences
app.get('/api/words/:wordId/sentences', (req, res) => {
  const rows = db.prepare('SELECT id, word_id as wordId, text, created_at as createdAt FROM sentences WHERE word_id = ? ORDER BY created_at DESC').all(req.params.wordId)
  res.json(rows)
})

app.post('/api/words/:wordId/sentences', (req, res) => {
  const { id, text, createdAt } = req.body
  db.prepare('INSERT INTO sentences (id, word_id, text, created_at) VALUES (?, ?, ?, ?)').run(id, req.params.wordId, text, createdAt)
  res.status(201).json({ ok: true })
})

app.patch('/api/sentences/:id', (req, res) => {
  const { text } = req.body
  db.prepare('UPDATE sentences SET text = ? WHERE id = ?').run(text, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/sentences/:id', (req, res) => {
  db.prepare('DELETE FROM sentences WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Custom Phrases
app.get('/api/custom-phrases', (req, res) => {
  const rows = db.prepare('SELECT id, phrase, created_at as createdAt FROM custom_phrases ORDER BY created_at ASC').all()
  res.json(rows)
})

app.post('/api/custom-phrases', (req, res) => {
  const { id, phrase, createdAt } = req.body
  try {
    db.prepare('INSERT INTO custom_phrases (id, phrase, created_at) VALUES (?, ?, ?)').run(id, phrase, createdAt)
    res.status(201).json({ ok: true })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Phrase already exists' })
    } else {
      res.status(500).json({ error: 'Failed to add phrase' })
    }
  }
})

app.delete('/api/custom-phrases/:id', (req, res) => {
  db.prepare('DELETE FROM custom_phrases WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.delete('/api/custom-phrases', (req, res) => {
  db.prepare('DELETE FROM custom_phrases').run()
  res.json({ ok: true })
})

// EPUB Files
app.post('/api/epub-files', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' })
  }

  const { groupId } = req.body
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required.' })
  }

  try {
    // Check if there's already an EPUB file for this group
    const existingFile = db.prepare('SELECT id, filename FROM epub_files WHERE group_id = ?').get(groupId)
    
    if (existingFile) {
      // Delete the existing file from disk
      const existingFilePath = path.join(__dirname, 'uploads', existingFile.filename)
      if (fs.existsSync(existingFilePath)) {
        fs.unlinkSync(existingFilePath)
      }
      
      // Delete the existing record from database
      db.prepare('DELETE FROM epub_files WHERE id = ?').run(existingFile.id)
    }
    
    const id = crypto.randomBytes(16).toString('hex')
    const createdAt = Date.now()
    db.prepare('INSERT INTO epub_files (id, group_id, filename, original_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, groupId, req.file.filename, req.file.originalname, req.file.size, createdAt)
    res.status(201).json({ 
      ok: true, 
      id: id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      createdAt: createdAt
    })
  } catch (error) {
    console.error('EPUB upload error:', error)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

app.get('/api/epub-files', (req, res) => {
  const rows = db.prepare('SELECT id, group_id as groupId, filename, original_name as originalName, file_size as fileSize, created_at as createdAt FROM epub_files ORDER BY created_at DESC').all()
  res.json(rows)
})

app.get('/api/epub-files/group/:groupId', (req, res) => {
  const rows = db.prepare('SELECT id, group_id as groupId, filename, original_name as originalName, file_size as fileSize, created_at as createdAt FROM epub_files WHERE group_id = ? ORDER BY created_at DESC').all(req.params.groupId)
  res.json(rows)
})

app.get('/api/epub-files/:id/view', (req, res) => {
  console.log('View request for file ID:', req.params.id)
  const file = db.prepare('SELECT filename, original_name as originalName FROM epub_files WHERE id = ?').get(req.params.id)
  if (file) {
    console.log('File found:', file.filename)
    const filePath = path.join(__dirname, 'uploads', file.filename)
    if (fs.existsSync(filePath)) {
      // Check if the file is a ZIP file
      if (file.filename.endsWith('.zip')) {
        console.log('File is a ZIP, extracting...')
        // Extract the EPUB file from the ZIP
        const extractPath = path.join(__dirname, 'uploads', 'extracted', req.params.id)
        
        // Create extraction directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'uploads', 'extracted'))) {
          fs.mkdirSync(path.join(__dirname, 'uploads', 'extracted'), { recursive: true })
        }
        
        // Check if already extracted
        console.log('Checking extraction path:', extractPath)
        if (fs.existsSync(extractPath)) {
          console.log('Extraction path exists, checking for EPUB directories...')
          const items = fs.readdirSync(extractPath)
          console.log('Found items:', items)
          const epubDirs = items.filter(item => {
            const itemPath = path.join(extractPath, item)
            return fs.statSync(itemPath).isDirectory() && item.endsWith('.epub')
          })
          console.log('Found EPUB directories:', epubDirs)
          if (epubDirs.length > 0) {
            // Serve the extracted EPUB directory
            const epubDirPath = path.join(extractPath, epubDirs[0])
            console.log('Serving extracted EPUB directory:', epubDirPath)
            // Serve the container.xml file which is the entry point
            const containerPath = path.join(epubDirPath, 'META-INF', 'container.xml')
            if (fs.existsSync(containerPath)) {
              res.sendFile(containerPath)
            } else {
              res.status(500).json({ error: 'No container.xml found in extracted EPUB' })
            }
            return
          }
        }
        
        // Extract the ZIP file
        console.log('Starting extraction to:', extractPath)
        extract(filePath, { dir: extractPath })
          .then(() => {
            const items = fs.readdirSync(extractPath)
            const epubDirs = items.filter(item => {
              const itemPath = path.join(extractPath, item)
              return fs.statSync(itemPath).isDirectory() && item.endsWith('.epub')
            })
            if (epubDirs.length > 0) {
              const epubDirPath = path.join(extractPath, epubDirs[0])
              const containerPath = path.join(epubDirPath, 'META-INF', 'container.xml')
              if (fs.existsSync(containerPath)) {
                res.sendFile(containerPath)
              } else {
                res.status(500).json({ error: 'No container.xml found in extracted EPUB' })
              }
            } else {
              res.status(500).json({ error: 'No EPUB directory found in ZIP' })
            }
          })
          .catch(err => {
            console.error('Extraction error:', err)
            res.status(500).json({ error: 'Failed to extract EPUB file' })
          })
      } else {
        // Serve the file directly if it's not a ZIP
        res.sendFile(filePath)
      }
    } else {
      res.status(404).json({ error: 'File not found on disk' })
    }
  } else {
    res.status(404).json({ error: 'File not found' })
  }
})

app.get('/api/epub-files/:id', (req, res) => {
  const file = db.prepare('SELECT filename, original_name as originalName FROM epub_files WHERE id = ?').get(req.params.id)
  if (file) {
    res.download(path.join(__dirname, 'uploads', file.filename), file.originalName)
  } else {
    res.status(404).json({ error: 'File not found' })
  }
})

app.delete('/api/epub-files/:id', (req, res) => {
  const file = db.prepare('SELECT filename FROM epub_files WHERE id = ?').get(req.params.id)
  if (file) {
    const filePath = path.join(__dirname, 'uploads', file.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    db.prepare('DELETE FROM epub_files WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  } else {
    res.status(404).json({ error: 'File not found' })
  }
})

// Reading Progress
app.post('/api/reading-progress', (req, res) => {
  const { id, fileId, location, progress, lastReadAt } = req.body
  
  if (!id || !fileId || !location || progress === undefined || !lastReadAt) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Use INSERT OR REPLACE to handle the unique constraint on file_id
    db.prepare('INSERT OR REPLACE INTO reading_progress (id, file_id, location, progress, last_read_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, fileId, location, progress, lastReadAt)
    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('Reading progress save error:', error)
    res.status(500).json({ error: 'Failed to save reading progress' })
  }
})

app.get('/api/reading-progress/:fileId', (req, res) => {
  const progress = db.prepare('SELECT id, file_id as fileId, location, progress, last_read_at as lastReadAt FROM reading_progress WHERE file_id = ?').get(req.params.fileId)
  
  if (progress) {
    res.json(progress)
  } else {
    res.status(404).json({ error: 'Reading progress not found' })
  }
})

app.patch('/api/reading-progress/:fileId', (req, res) => {
  const { location, progress, lastReadAt } = req.body
  
  if (!location || progress === undefined || !lastReadAt) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Use INSERT OR REPLACE to create or update in one operation
    const id = req.body.id || require('crypto').randomUUID()
    db.prepare('INSERT OR REPLACE INTO reading_progress (id, file_id, location, progress, last_read_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.fileId, location, progress, lastReadAt)
    res.json({ ok: true })
  } catch (error) {
    console.error('Reading progress update error:', error)
    res.status(500).json({ error: 'Failed to update reading progress' })
  }
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))


