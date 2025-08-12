const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const dbPath = path.join(__dirname, 'wordbook.db')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
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
`)

// Add frequency column to existing words table if it doesn't exist
try {
  db.exec('ALTER TABLE words ADD COLUMN frequency INTEGER NOT NULL DEFAULT 50')
  console.log('Added frequency column to words table')
} catch (error) {
  // Column already exists, ignore error
  console.log('Frequency column already exists or error adding it:', error.message)
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
    SELECT l.id, l.name, l.created_at as createdAt,
           (SELECT COUNT(1) FROM words w WHERE w.list_id = l.id) as wordsCount
    FROM lists l ORDER BY l.created_at DESC
  `).all()
  res.json(rows)
})

app.post('/api/lists', (req, res) => {
  const { id, name, createdAt } = req.body
  db.prepare('INSERT INTO lists (id, name, created_at) VALUES (?, ?, ?)').run(id, name, createdAt)
  res.status(201).json({ ok: true })
})

app.patch('/api/lists/:id', (req, res) => {
  const { name } = req.body
  db.prepare('UPDATE lists SET name = ? WHERE id = ?').run(name, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/lists/:id', (req, res) => {
  db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id)
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

const port = process.env.PORT || 5175
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))


