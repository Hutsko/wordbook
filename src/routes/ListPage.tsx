import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addWord, fetchLists, fetchWords, renameList, updateWord, deleteWord, fetchSentences, addSentence, updateSentence, deleteSentence, type Word, type Sentence } from '../db'
import { autocompleteFromSentence } from '../ai/gemini'

export default function ListPage() {
  const params = useParams()
  const listId = params.id as string
  const [listName, setListName] = useState<string>('')
  const [isEditingName, setIsEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<Word | null>(null)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const termRef = useRef<HTMLInputElement | null>(null)
  const transcriptionRef = useRef<HTMLInputElement | null>(null)
  const definitionRef = useRef<HTMLTextAreaElement | null>(null)
  const editTermRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isResizingRef = useRef(false)
  const [panelWidth, setPanelWidth] = useState<number>(320)
  const minPanel = 240
  const maxPanel = 560
  const [manualSentenceEnabled, setManualSentenceEnabled] = useState(false)
  const [manualSentenceText, setManualSentenceText] = useState('')
  const [manualSelection, setManualSelection] = useState<{ start: number; end: number } | null>(null)
  const [manualSelectedTerm, setManualSelectedTerm] = useState<string | null>(null)

  useEffect(() => {
    fetchLists().then((lists) => {
      const current = lists.find((l) => l.id === listId)
      setListName(current?.name ?? 'List')
    })
    fetchWords(listId).then(setWords)
  }, [listId])

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  useEffect(() => {
    if (isModalOpen) {
      termRef.current?.focus()
      termRef.current?.select()
    }
  }, [isModalOpen])

  useEffect(() => {
    if (isEditModalOpen) {
      editTermRef.current?.focus()
      editTermRef.current?.select()
    }
  }, [isEditModalOpen])

  const handleAddWord = async () => {
    setIsModalOpen(true)
  }

  const startEditName = () => setIsEditingName(true)

  const commitEditName = async () => {
    const value = nameInputRef.current?.value?.trim() ?? ''
    if (!value) {
      setIsEditingName(false)
      return
    }
    await renameList(listId, value)
    setListName(value)
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitEditName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditingName(false)
    }
  }

  // Close details on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedWord(null)
        setSentences([])
      }
    }
    if (selectedWord) {
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [selectedWord])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isResizingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const proposed = e.clientX - rect.left
      const clamped = Math.max(minPanel, Math.min(maxPanel, proposed))
      setPanelWidth(clamped)
    }
    function onUp() {
      isResizingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    if (isResizingRef.current) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }
  }, [isResizingRef.current])

  const [activeTab, setActiveTab] = useState<'list' | 'progress'>('list')

  useEffect(() => {
    if (!isModalOpen) {
      setManualSentenceEnabled(false)
      setManualSentenceText('')
      setManualSelection(null)
      setManualSelectedTerm(null)
    }
  }, [isModalOpen])

  return (
    <div className="page">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/" className="btn" style={{ textDecoration: 'none' }}>
            ← Back
          </Link>
          {isEditingName ? (
            <input
              ref={nameInputRef}
              defaultValue={listName}
              onKeyDown={handleNameKeyDown}
              onBlur={commitEditName}
              style={{
                fontSize: '1.5rem',
                padding: '0.35rem 0.5rem',
                borderRadius: 8,
                border: '1px solid #3a3a3a',
                background: '#1a1a1a',
                color: 'inherit',
              }}
            />
          ) : (
            <h1
              className="title"
              style={{ cursor: 'text', margin: 0 }}
              onClick={startEditName}
            >
              {listName}
            </h1>
          )}
        </div>
        <div>
          <button className="create-btn" onClick={handleAddWord}>
            Add Word +
          </button>
        </div>
      </header>

      <div style={{ padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button className="btn" onClick={() => setActiveTab('list')} style={{ borderColor: activeTab === 'list' ? '#646cff' : undefined }}>Word list</button>
          <button className="btn" onClick={() => setActiveTab('progress')} style={{ borderColor: activeTab === 'progress' ? '#646cff' : undefined }}>Learning progress</button>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div
          ref={containerRef}
          style={{
            display: 'grid',
            gridTemplateColumns: selectedWord ? `${panelWidth}px 6px 1fr` : '1fr',
          }}
        >
          {selectedWord && (
            <aside style={{ borderRight: '1px solid #2a2a2a', padding: '0 1.25rem', overflow: 'auto' }}>
              <div style={{ padding: '0.75rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Details</strong>
                  <button className="btn" onClick={() => { setSelectedWord(null); setSentences([]) }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Word</span>
                    <input
                      value={selectedWord.term}
                      onChange={(e) => setSelectedWord((w) => (w ? { ...w, term: e.target.value } : w))}
                      onBlur={async (e) => {
                        if (!selectedWord) return
                        await updateWord(selectedWord.id, e.target.value, selectedWord.transcription, selectedWord.definition)
                        setWords((prev) => prev.map((w) => (w.id === selectedWord.id ? { ...w, term: e.target.value } : w)))
                      }}
                      style={{ padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Transcription</span>
                    <input
                      value={selectedWord.transcription ?? ''}
                      onChange={(e) => setSelectedWord((w) => (w ? { ...w, transcription: e.target.value } : w))}
                      onBlur={async (e) => {
                        if (!selectedWord) return
                        await updateWord(selectedWord.id, selectedWord.term, e.target.value || null, selectedWord.definition)
                        setWords((prev) => prev.map((w) => (w.id === selectedWord.id ? { ...w, transcription: e.target.value || null } : w)))
                      }}
                      style={{ padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit' }}
                    />
                  </label>
                </div>
                <label style={{ display: 'grid', gap: 6, marginTop: '0.75rem' }}>
                  <span>Definition</span>
                  <textarea
                    value={selectedWord.definition ?? ''}
                    onChange={(e) => setSelectedWord((w) => (w ? { ...w, definition: e.target.value } : w))}
                    onBlur={async (e) => {
                      if (!selectedWord) return
                      await updateWord(selectedWord.id, selectedWord.term, selectedWord.transcription, e.target.value || null)
                      setWords((prev) => prev.map((w) => (w.id === selectedWord.id ? { ...w, definition: e.target.value || null } : w)))
                    }}
                    rows={3}
                    style={{ padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit', resize: 'vertical' }}
                  />
                </label>
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Sentences (up to 10)</div>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const s = sentences[idx]
                      return (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ color: '#9aa0a6', width: 18 }}>{idx + 1}.</span>
                          <input
                            value={s?.text ?? ''}
                            placeholder="Type a sentence"
                            onChange={(e) => {
                              const text = e.target.value
                              setSentences((prev) => {
                                const next = [...prev]
                                if (s) next[idx] = { ...s, text }
                                else next[idx] = { id: '', wordId: selectedWord!.id, text, createdAt: Date.now() }
                                return next
                              })
                            }}
                            onBlur={async (e) => {
                              const text = e.target.value.trim()
                              const current = sentences[idx]
                              if (!text) {
                                if (current && current.id) {
                                  await deleteSentence(current.id)
                                  setSentences((prev) => prev.filter((_, i) => i !== idx))
                                }
                                return
                              }
                              if (current && current.id) {
                                await updateSentence(current.id, text)
                                setSentences((prev) => prev.map((x, i) => (i === idx ? { ...x, text } : x)))
                              } else {
                                const created = await addSentence(selectedWord!.id, text)
                                setSentences((prev) => prev.map((x, i) => (i === idx ? created : x)))
                              }
                            }}
                            style={{ flex: 1, padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit' }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </aside>
          )}
          {selectedWord && (
            <div
              onMouseDown={() => {
                isResizingRef.current = true
              }}
              style={{ cursor: 'col-resize', background: '#2a2a2a', width: 6 }}
            />
          )}
          <div style={{ padding: '0 1.25rem' }}>
        <div style={{ marginBottom: '0.5rem', color: '#9aa0a6' }}>{words.length} words</div>
        {words.length === 0 ? (
          <div className="empty">
            <p>No words in this list yet.</p>
            <button className="create-btn" onClick={handleAddWord}>
              Add Word +
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Word</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Transcription</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Definition</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Strength</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {words.map((w) => (
                  <tr
                    key={w.id}
                    style={{
                      borderTop: '1px solid #2a2a2a',
                      cursor: 'pointer',
                      background: selectedWord?.id === w.id ? '#1c1c1c' : undefined,
                    }}
                    onClick={async () => {
                      setSelectedWord(w)
                      // fetch sentences for selected
                      const ss = await fetchSentences(w.id)
                      setSentences(ss)
                    }}
                  >
                    <td style={{ padding: '0.5rem' }}>{w.term}</td>
                    <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>{w.transcription ?? ''}</td>
                    <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>{w.definition ?? ''}</td>
                      <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>{w.strength ?? 0}%</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingWord(w)
                          setIsEditModalOpen(true)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn danger"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const confirmed = window.confirm(`Delete "${w.term}"?`)
                          if (!confirmed) return
                          await deleteWord(w.id)
                          setWords((prev) => prev.filter((x) => x.id !== w.id))
                        }}
                        style={{ marginLeft: '0.5rem' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 1.25rem' }}>
          <div className="empty">
            <p>Learning progress</p>
            <button className="create-btn" onClick={() => { /* no-op for now */ }}>
              Generate learning path
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              width: 'min(560px, 96vw)',
              background: '#121212',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Add Word</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            {(
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const term = termRef.current?.value?.trim()
                  if (!term) return
                  const transcription = transcriptionRef.current?.value?.trim() || null
                  const definition = definitionRef.current?.value?.trim() || null
                  const created = await addWord(listId, term, transcription, definition)
                  // Optionally save sentence
                  if (manualSentenceEnabled && manualSentenceText.trim()) {
                    await addSentence(created.id, manualSentenceText.trim())
                  }
                  setWords((prev) => [created, ...prev])
                  setIsModalOpen(false)
                }}
                style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
              >
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Word</span>
                  <input
                    ref={termRef}
                    required
                    placeholder="enter word"
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#1a1a1a',
                      color: 'inherit',
                    }}
                  />
                </label>
                <div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setManualSentenceEnabled((v) => !v)}
                    style={{ marginBottom: manualSentenceEnabled ? '0.5rem' : 0 }}
                  >
                    {manualSentenceEnabled ? 'Remove sentence' : 'Add sentence'}
                  </button>
                  {manualSentenceEnabled && (
                    <>
                      <input
                        value={manualSentenceText}
                        onChange={(e) => setManualSentenceText(e.target.value)}
                        onSelect={(e) => {
                          const target = e.target as HTMLInputElement
                          const start = target.selectionStart ?? 0
                          const end = target.selectionEnd ?? 0
                          if (start !== end) setManualSelection({ start, end })
                          else setManualSelection(null)
                        }}
                        placeholder="Type a sentence (optional)"
                        style={{
                          marginTop: '0.5rem',
                          width: '100%',
                          padding: '0.6rem 0.75rem',
                          borderRadius: 8,
                          border: '1px solid #3a3a3a',
                          background: '#1a1a1a',
                          color: 'inherit',
                        }}
                      />
                      {manualSelection && manualSentenceText.slice(manualSelection.start, manualSelection.end).trim() && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ color: '#9aa0a6' }}>
                            Selected: “{manualSentenceText.slice(manualSelection.start, manualSelection.end)}”
                          </span>
                          <button
                            className="create-btn"
                            onClick={(e) => {
                              e.preventDefault()
                              const term = manualSentenceText.slice(manualSelection.start!, manualSelection.end!).trim()
                              if (!term) return
                              setManualSelectedTerm(term)
                              if (termRef.current) {
                                termRef.current.value = term
                                termRef.current.focus()
                                termRef.current.select()
                              }
                              const sentence = manualSentenceText.trim()
                              if (sentence) {
                                autocompleteFromSentence({ term, sentence })
                                  .then((res) => {
                                    if (res.transcription && transcriptionRef.current) transcriptionRef.current.value = res.transcription
                                    if (res.definition && definitionRef.current) definitionRef.current.value = res.definition
                                  })
                                  .catch((err) => console.error('AI autocomplete failed', err))
                              }
                            }}
                          >
                            Define with AI
                          </button>
                        </div>
                      )}
                      {manualSelectedTerm && (
                        <div style={{ color: '#9aa0a6' }}>
                          To define: “{manualSelectedTerm}”. This will be kept while the modal stays open.
                        </div>
                      )}
                    </>
                  )}
                </div>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Transcription</span>
                  <input
                    ref={transcriptionRef}
                    placeholder="/trænˈskrɪpʃən/"
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#1a1a1a',
                      color: 'inherit',
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Definition</span>
                  <textarea
                    ref={definitionRef}
                    rows={4}
                    placeholder="enter definition"
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#1a1a1a',
                      color: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="create-btn">Add</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && editingWord && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            style={{
              width: 'min(560px, 96vw)',
              background: '#121212',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit Word</h2>
              <button className="btn" onClick={() => setIsEditModalOpen(false)}>✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const term = (e.currentTarget.elements.namedItem('term') as HTMLInputElement)?.value?.trim()
                if (!term) return
                const transcription = (e.currentTarget.elements.namedItem('transcription') as HTMLInputElement)?.value?.trim() || null
                const definition = (e.currentTarget.elements.namedItem('definition') as HTMLTextAreaElement)?.value?.trim() || null
                await updateWord(editingWord.id, term, transcription, definition)
                setWords((prev) =>
                  prev.map((w) => (w.id === editingWord.id ? { ...w, term, transcription, definition } : w)),
                )
                setIsEditModalOpen(false)
                setEditingWord(null)
              }}
              style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Word</span>
                <input
                  name="term"
                  ref={editTermRef}
                  defaultValue={editingWord.term}
                  required
                  style={{ padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Transcription</span>
                <input name="transcription" defaultValue={editingWord.transcription ?? ''} style={{ padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Definition</span>
                <textarea name="definition" defaultValue={editingWord.definition ?? ''} rows={4} style={{ padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #3a3a3a', background: '#1a1a1a', color: 'inherit', resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="create-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


