const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')
const multer = require('multer')
const fs = require('fs')
const crypto = require('crypto')
const AdmZip = require('adm-zip')

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
    // Allow EPUB files and compressed EPUB files
    const fileName = file.originalname.toLowerCase()
    if (file.mimetype === 'application/epub+zip' || 
        file.mimetype === 'application/epub' ||
        file.mimetype === 'application/zip' ||
        fileName.endsWith('.epub') ||
        fileName.endsWith('.epub.zip')) {
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
`)

// Add frequency column to existing words table if it doesn't exist
try {
  db.exec('ALTER TABLE words ADD COLUMN frequency INTEGER NOT NULL DEFAULT 50')
  console.log('Added frequency column to words table')
} catch (error) {
  // Column already exists, ignore error
  console.log('Frequency column already exists or error adding it:', error.message)
}

// Add group_id column to existing lists table if it doesn't exist
try {
  db.exec('ALTER TABLE lists ADD COLUMN group_id TEXT REFERENCES word_groups(id) ON DELETE SET NULL')
  console.log('Added group_id column to lists table')
} catch (error) {
  // Column already exists, ignore error
  console.log('Group ID column already exists or error adding it:', error.message)
}

// Add order_index column to existing lists table if it doesn't exist
try {
  db.exec('ALTER TABLE lists ADD COLUMN order_index INTEGER DEFAULT 0')
  console.log('Added order_index column to lists table')
  
  // Initialize order_index for existing lists based on created_at
  db.exec(`
    UPDATE lists 
    SET order_index = (
      SELECT COUNT(*) 
      FROM lists l2 
      WHERE l2.created_at >= lists.created_at
    ) - 1
  `)
  console.log('Initialized order_index for existing lists')
} catch (error) {
  // Column already exists, ignore error
  console.log('Order index column already exists or error adding it:', error.message)
}

// Seed default phrases once (only if table is empty)
try {
  const { count } = db.prepare('SELECT COUNT(1) as count FROM custom_phrases').get()
  if (Number(count) === 0) {
    const defaultPhrases = [
      'Excerpt From',
      'This material may be protected by copyright.',
      'All rights reserved.',
      'Reprinted with permission.',
      'Source:',
      'From the book:',
      'Chapter',
      'Page',
    ]
    const insert = db.prepare('INSERT INTO custom_phrases (id, phrase, created_at) VALUES (?, ?, ?)')
    const now = Date.now()
    defaultPhrases.forEach((phrase, idx) => {
      insert.run(`${idx}-${now}`, phrase, now + idx)
    })
  }
} catch (err) {
  console.error('Failed to seed default custom phrases', err)
}

app.get('/api/lists', (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.name, l.group_id as groupId, l.created_at as createdAt, l.order_index as orderIndex,
           (SELECT COUNT(1) FROM words w WHERE w.list_id = l.id) as wordsCount
    FROM lists l ORDER BY l.order_index ASC
  `).all()
  res.json(rows)
})

app.post('/api/lists', (req, res) => {
  const { id, name, groupId, createdAt } = req.body
  
  // Get the next order_index for this group (or ungrouped)
  let maxOrderResult
  if (groupId) {
    maxOrderResult = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) as maxOrder 
      FROM lists 
      WHERE group_id = ?
    `).get(groupId)
  } else {
    maxOrderResult = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) as maxOrder 
      FROM lists 
      WHERE group_id IS NULL
    `).get()
  }
  
  const nextOrderIndex = (maxOrderResult.maxOrder || 0) + 1
  
  db.prepare('INSERT INTO lists (id, name, group_id, created_at, order_index) VALUES (?, ?, ?, ?, ?)').run(id, name, groupId || null, createdAt, nextOrderIndex)
  res.status(201).json({ ok: true })
})

app.patch('/api/lists/:id', (req, res) => {
  const { name, groupId } = req.body
  
  if (name !== undefined && groupId !== undefined) {
    // Update both name and group
    db.prepare('UPDATE lists SET name = ?, group_id = ? WHERE id = ?').run(name, groupId || null, req.params.id)
  } else if (name !== undefined) {
    // Update only name
    db.prepare('UPDATE lists SET name = ? WHERE id = ?').run(name, req.params.id)
  } else if (groupId !== undefined) {
    // Update only group
    db.prepare('UPDATE lists SET group_id = ? WHERE id = ?').run(groupId || null, req.params.id)
  }
  
  res.json({ ok: true })
})

app.delete('/api/lists/:id', (req, res) => {
  db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})



// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint works' })
})

// Lists reorder endpoint
app.post('/api/reorder-lists', (req, res) => {
  console.log('Reorder endpoint called')
  const { listIds, groupId } = req.body
  
  if (!Array.isArray(listIds)) {
    return res.status(400).json({ error: 'listIds must be an array' })
  }
  
  console.log('Reordering lists:', listIds, 'in group:', groupId)
  
  // For group-specific reordering, we need to preserve the order of other groups
  // and only update the order_index for lists in the specified group
  
  // First, get all lists to understand the current order
  const allLists = db.prepare('SELECT id, group_id, order_index FROM lists ORDER BY order_index ASC').all()
  
  // Separate lists by group
  const targetGroupLists = allLists.filter(l => l.group_id === groupId)
  const otherGroupsLists = allLists.filter(l => l.group_id !== groupId)
  
  // Calculate the base order_index for the target group
  const baseOrderIndex = otherGroupsLists.length > 0 
    ? Math.max(...otherGroupsLists.map(l => l.order_index)) + 1 
    : 0
  
  // Update the order_index for lists in the target group
  const updateStmt = db.prepare('UPDATE lists SET order_index = ? WHERE id = ?')
  
  listIds.forEach((listId, index) => {
    const newOrderIndex = baseOrderIndex + index
    updateStmt.run(newOrderIndex, listId)
  })
  
  console.log('Reorder completed')
  res.json({ ok: true })
})

// Word Groups API
app.get('/api/word-groups', (req, res) => {
  const rows = db.prepare(`
    SELECT wg.id, wg.name, wg.created_at as createdAt,
           (SELECT COUNT(1) FROM lists l WHERE l.group_id = wg.id) as listsCount
    FROM word_groups wg ORDER BY wg.created_at ASC
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

app.get('/api/lists/:listId/words', (req, res) => {
  const rows = db.prepare('SELECT id, term, transcription, definition, strength, frequency, created_at as createdAt FROM words WHERE list_id = ? ORDER BY created_at DESC').all(req.params.listId)
  res.json(rows)
})

app.post('/api/lists/:listId/words', (req, res) => {
  const { id, term, transcription, definition, strength = 0, frequency = 50, createdAt } = req.body
  db.prepare('INSERT INTO words (id, list_id, term, transcription, definition, strength, frequency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.listId, term, transcription, definition, strength, frequency, createdAt)
  res.status(201).json({ ok: true })
})

app.patch('/api/words/:id', (req, res) => {
  const { term, transcription, definition, strength, frequency } = req.body
  db.prepare('UPDATE words SET term = ?, transcription = ?, definition = ?, strength = COALESCE(?, strength), frequency = COALESCE(?, frequency) WHERE id = ?')
    .run(term, transcription, definition, strength ?? null, frequency ?? null, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/words/:id', (req, res) => {
  db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

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

app.get('/api/epub-files/:id/info', (req, res) => {
  const file = db.prepare('SELECT id, group_id as groupId, filename, original_name as originalName, file_size as fileSize, created_at as createdAt FROM epub_files WHERE id = ?').get(req.params.id)
  if (file) {
    res.json(file)
  } else {
    res.status(404).json({ error: 'File not found' })
  }
})

app.get('/api/epub-files/:id', (req, res) => {
  const file = db.prepare('SELECT filename, original_name as originalName FROM epub_files WHERE id = ?').get(req.params.id)
  if (file) {
    const filePath = path.join(__dirname, 'uploads', file.filename)
    
    // Set CORS headers for EPUB files
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
    
    // Set content type based on file extension
    const ext = path.extname(file.originalName).toLowerCase()
    if (ext === '.epub') {
      res.setHeader('Content-Type', 'application/epub+zip')
    } else if (ext === '.zip') {
      res.setHeader('Content-Type', 'application/zip')
    }
    
    res.download(filePath, file.originalName)
  } else {
    res.status(404).json({ error: 'File not found' })
  }
})

// New endpoint for decompressed EPUB viewing
// Test endpoint to check if file exists and is accessible
app.get('/api/epub-files/:id/test', (req, res) => {
  console.log('EPUB test request for ID:', req.params.id)
  const file = db.prepare('SELECT filename, original_name as originalName FROM epub_files WHERE id = ?').get(req.params.id)
  if (!file) {
    console.log('File not found in database for ID:', req.params.id)
    return res.status(404).json({ error: 'File not found' })
  }
  
  const filePath = path.join(__dirname, 'uploads', file.filename)
  const exists = fs.existsSync(filePath)
  const stats = exists ? fs.statSync(filePath) : null
  
  res.json({
    exists,
    filename: file.filename,
    originalName: file.originalName,
    fileSize: stats ? stats.size : null,
    filePath: filePath
  })
})

app.get('/api/epub-files/:id/view', (req, res) => {
  console.log('EPUB view request for ID:', req.params.id)
  const file = db.prepare('SELECT filename, original_name as originalName FROM epub_files WHERE id = ?').get(req.params.id)
  if (!file) {
    console.log('File not found in database for ID:', req.params.id)
    return res.status(404).json({ error: 'File not found' })
  }
  console.log('Found file:', file.filename, 'Original name:', file.originalName)

  const filePath = path.join(__dirname, 'uploads', file.filename)
  const ext = path.extname(file.originalName).toLowerCase()
  
  try {
    if (ext === '.zip' || file.originalName.toLowerCase().endsWith('.epub.zip')) {
      // Handle compressed EPUB file
      console.log('Decompressing EPUB file:', file.originalName)
      
      const zip = new AdmZip(filePath)
      const zipEntries = zip.getEntries()
      
            console.log('ZIP entries:', zipEntries.map(entry => entry.entryName))
      
      // Check if this is actually an EPUB file (has mimetype with application/epub+zip)
      const mimetypeEntry = zipEntries.find(entry => entry.entryName === 'mimetype')
      if (mimetypeEntry) {
        const mimetype = mimetypeEntry.getData().toString()
        console.log('Mimetype found:', mimetype)
        
        if (mimetype.includes('application/epub+zip')) {
          // This is an EPUB file, serve it directly
          console.log('This is a valid EPUB file, serving all contents')
          
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
          res.setHeader('Content-Type', 'application/epub+zip')
          
          // Send the ZIP data directly (EPUB is just a ZIP with specific structure)
          const zipData = zip.toBuffer()
          res.setHeader('Content-Length', zipData.length)
          res.send(zipData)
          return
        }
      }
      
      // If not a direct EPUB, look for EPUB files inside the ZIP
      const epubEntries = zipEntries.filter(entry => 
        entry.entryName.toLowerCase().endsWith('.epub')
      )
      
      if (epubEntries.length > 0) {
        console.log('Found EPUB files in ZIP:', epubEntries.map(e => e.entryName))
        
        // Use the first EPUB file found
        const epubEntry = epubEntries[0]
        console.log('Using EPUB file:', epubEntry.entryName)
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
        res.setHeader('Content-Type', 'application/epub+zip')
        res.setHeader('Content-Length', epubEntry.header.size)
        
        // Send the extracted EPUB content
        res.send(epubEntry.getData())
        return
      }
      
      // Look for EPUB folder structure (common pattern)
      const epubFolders = zipEntries.filter(entry => 
        entry.entryName.endsWith('.epub/') || 
        (entry.entryName.includes('.epub/') && entry.entryName.endsWith('/'))
      )
      
      if (epubFolders.length > 0) {
        console.log('Found EPUB folder structure:', epubFolders.map(e => e.entryName))
        
        // Create a new ZIP with the EPUB contents at the root
        const newZip = new AdmZip()
        const folderName = epubFolders[0].entryName.replace(/\/$/, '') // Remove trailing slash
        
        // Copy all files from the EPUB folder to the root of the new ZIP
        zipEntries.forEach(entry => {
          if (entry.entryName.startsWith(folderName + '/') && !entry.entryName.endsWith('/')) {
            const newName = entry.entryName.substring(folderName.length + 1) // Remove folder prefix
            newZip.addFile(newName, entry.getData())
          }
        })
        
        console.log('Created new EPUB structure with files at root')
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
        res.setHeader('Content-Type', 'application/epub+zip')
        
        // Send the reconstructed EPUB
        const newZipData = newZip.toBuffer()
        res.setHeader('Content-Length', newZipData.length)
        res.send(newZipData)
        return
      }
      
      // If we get here, no EPUB file was found
      return res.status(400).json({ 
        error: 'No EPUB file found in the ZIP archive. Available files: ' + 
               zipEntries.map(entry => entry.entryName).join(', ')
      })
      
    } else {
      // Handle regular EPUB file
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
      res.setHeader('Content-Type', 'application/epub+zip')
      
      res.download(filePath, file.originalName)
    }
    
  } catch (error) {
    console.error('Error serving EPUB file:', error)
    res.status(500).json({ error: 'Failed to serve EPUB file' })
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

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))


