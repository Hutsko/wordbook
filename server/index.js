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

const port = process.env.PORT || 5175
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))


