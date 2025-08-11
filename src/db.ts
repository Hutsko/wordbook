const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5174/api'

export type WordList = { id: string; name: string; wordsCount: number }
export type Word = { id: string; term: string; transcription: string | null; definition: string | null; strength: number; createdAt: number }
export type Sentence = { id: string; wordId: string; text: string; createdAt: number }

export async function fetchLists(): Promise<WordList[]> {
  const res = await fetch(`${API_BASE}/lists`)
  if (!res.ok) throw new Error('Failed to fetch lists')
  const data = await res.json()
  return data.map((l: any) => ({ id: l.id, name: l.name, wordsCount: Number(l.wordsCount ?? 0) }))
}

export async function createList(name: string): Promise<WordList> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await fetch(`${API_BASE}/lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, createdAt }) })
  return { id, name, wordsCount: 0 }
}

export async function renameList(id: string, name: string): Promise<void> {
  await fetch(`${API_BASE}/lists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
}

export async function deleteList(id: string): Promise<void> {
  await fetch(`${API_BASE}/lists/${id}`, { method: 'DELETE' })
}

export async function fetchWords(listId: string): Promise<Word[]> {
  const res = await fetch(`${API_BASE}/lists/${listId}/words`)
  if (!res.ok) throw new Error('Failed to fetch words')
  const data = await res.json()
  return data.map((row: any) => ({
    id: String(row.id),
    term: String(row.term),
    transcription: row.transcription ?? null,
    definition: row.definition ?? null,
    strength: Number(row.strength ?? 0),
    createdAt: Number(row.createdAt),
  }))
}

export async function addWord(
  listId: string,
  term: string,
  transcription: string | null,
  definition: string | null,
): Promise<Word> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await fetch(`${API_BASE}/lists/${listId}/words`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, term, transcription, definition, strength: 0, createdAt }) })
  return { id, term, transcription, definition, strength: 0, createdAt }
}

export async function updateWord(
  id: string,
  term: string,
  transcription: string | null,
  definition: string | null,
): Promise<void> {
  await fetch(`${API_BASE}/words/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term, transcription, definition }) })
}

export async function deleteWord(id: string): Promise<void> {
  await fetch(`${API_BASE}/words/${id}`, { method: 'DELETE' })
}

export async function fetchSentences(wordId: string): Promise<Sentence[]> {
  const res = await fetch(`${API_BASE}/words/${wordId}/sentences`)
  if (!res.ok) throw new Error('Failed to fetch sentences')
  return await res.json()
}

export async function addSentence(wordId: string, text: string): Promise<Sentence> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await fetch(`${API_BASE}/words/${wordId}/sentences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, text, createdAt }) })
  return { id, wordId, text, createdAt }
}

export async function updateSentence(id: string, text: string): Promise<void> {
  await fetch(`${API_BASE}/sentences/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
}

export async function deleteSentence(id: string): Promise<void> {
  await fetch(`${API_BASE}/sentences/${id}`, { method: 'DELETE' })
}


