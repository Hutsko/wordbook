const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'

export type WordGroup = { id: string; name: string; listsCount: number; createdAt: number }
export type WordList = { id: string; name: string; groupId: string | null; wordsCount: number; createdAt: number; orderIndex: number }
export type Word = { id: string; term: string; transcription: string | null; definition: string | null; strength: number; frequency: number; createdAt: number }
export type Sentence = { id: string; wordId: string; text: string; createdAt: number }

export async function fetchLists(): Promise<WordList[]> {
  const res = await fetch(`${API_BASE}/lists`)
  if (!res.ok) throw new Error('Failed to fetch lists')
  const data = await res.json()
  return data.map((l: any) => ({ 
    id: l.id, 
    name: l.name, 
    groupId: l.groupId || null,
    wordsCount: Number(l.wordsCount ?? 0),
    createdAt: Number(l.createdAt),
    orderIndex: Number(l.orderIndex ?? 0)
  }))
}

export async function createList(name: string, groupId?: string): Promise<WordList> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await fetch(`${API_BASE}/lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, groupId, createdAt }) })
  // The backend will assign the orderIndex, so we'll use a placeholder for now
  return { id, name, groupId: groupId || null, wordsCount: 0, createdAt, orderIndex: 0 }
}

export async function renameList(id: string, name: string): Promise<void> {
  await fetch(`${API_BASE}/lists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
}

export async function moveList(id: string, groupId: string | null): Promise<void> {
  await fetch(`${API_BASE}/lists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId }) })
}

export async function reorderLists(listIds: string[], groupId: string | null): Promise<void> {
  await fetch(`${API_BASE}/reorder-lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listIds, groupId }) })
}

export async function deleteList(id: string): Promise<void> {
  await fetch(`${API_BASE}/lists/${id}`, { method: 'DELETE' })
}

// Word Groups
export async function fetchWordGroups(): Promise<WordGroup[]> {
  const res = await fetch(`${API_BASE}/word-groups`)
  if (!res.ok) throw new Error('Failed to fetch word groups')
  const data = await res.json()
  return data.map((g: any) => ({ 
    id: g.id, 
    name: g.name, 
    listsCount: Number(g.listsCount ?? 0),
    createdAt: Number(g.createdAt)
  }))
}

export async function createWordGroup(name: string): Promise<WordGroup> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await fetch(`${API_BASE}/word-groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, createdAt }) })
  return { id, name, listsCount: 0, createdAt }
}

export async function renameWordGroup(id: string, name: string): Promise<void> {
  await fetch(`${API_BASE}/word-groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
}

export async function deleteWordGroup(id: string): Promise<void> {
  await fetch(`${API_BASE}/word-groups/${id}`, { method: 'DELETE' })
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
    frequency: Number(row.frequency ?? 50),
    createdAt: Number(row.createdAt),
  }))
}

export async function addWord(
  listId: string,
  term: string,
  transcription: string | null,
  definition: string | null,
  frequency: number = 50,
): Promise<Word> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  await fetch(`${API_BASE}/lists/${listId}/words`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, term, transcription, definition, strength: 0, frequency, createdAt }) })
  return { id, term, transcription, definition, strength: 0, frequency, createdAt }
}

export async function updateWord(
  id: string,
  term: string,
  transcription: string | null,
  definition: string | null,
  frequency?: number,
): Promise<void> {
  await fetch(`${API_BASE}/words/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term, transcription, definition, frequency }) })
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

// Custom Phrases
export async function fetchCustomPhrases(): Promise<{ id: string; phrase: string; createdAt: number }[]> {
  const res = await fetch(`${API_BASE}/custom-phrases`)
  if (!res.ok) throw new Error('Failed to fetch custom phrases')
  return await res.json()
}

export async function addCustomPhrase(phrase: string): Promise<void> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const res = await fetch(`${API_BASE}/custom-phrases`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ id, phrase, createdAt }) 
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to add custom phrase')
  }
}

export async function deleteCustomPhrase(id: string): Promise<void> {
  await fetch(`${API_BASE}/custom-phrases/${id}`, { method: 'DELETE' })
}

export async function clearAllCustomPhrases(): Promise<void> {
  await fetch(`${API_BASE}/custom-phrases`, { method: 'DELETE' })
}

// Helper: get only phrases (strings)
export async function getAllCustomPhraseStrings(): Promise<string[]> {
  const rows = await fetchCustomPhrases()
  return rows.map((r) => r.phrase)
}


