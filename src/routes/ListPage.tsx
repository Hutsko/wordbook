import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchLists, fetchWords, renameList, updateWord, deleteWord, createList, addWord, type Word } from '../db'
import WordDetailsPanel from '../components/WordDetailsPanel'
import WordTable from '../components/WordTable'
import BulkActionsBar from '../components/BulkActionsBar'
import AddWordModal from '../components/AddWordModal'
import { usePanelResize } from '../hooks/usePanelResize'

export default function ListPage() {
  const params = useParams()
  const listId = params.id as string
  
  // State
  const [listName, setListName] = useState<string>('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [words, setWords] = useState<Word[]>([])
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set())
  const [availableLists, setAvailableLists] = useState<{ id: string; name: string }[]>([])
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<Word | null>(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'list' | 'progress'>('list')
  
  // Refs
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  // Panel resize hook
  const { panelWidth, startResize } = usePanelResize({
    initialWidth: 320,
    minWidth: 240,
    maxWidth: 560
  })

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [lists, wordsData] = await Promise.all([
          fetchLists(),
          fetchWords(listId)
        ])
        
        const current = lists.find((l) => l.id === listId)
        setListName(current?.name ?? 'List')
        setAvailableLists(lists.filter(l => l.id !== listId))
        setWords(wordsData)
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    
    loadData()
  }, [listId])

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedWord(null)
        setIsAddModalOpen(false)
        setIsEditModalOpen(false)
        setIsMoveModalOpen(false)
      }
    }
    
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // List name handlers
  const handleStartEditName = () => setIsEditingName(true)
  
  const handleCommitEditName = async () => {
    const value = nameInputRef.current?.value?.trim() ?? ''
    if (!value) {
      setIsEditingName(false)
      return
    }
    
    try {
      await renameList(listId, value)
      setListName(value)
    } catch (error) {
      console.error('Failed to rename list:', error)
    } finally {
      setIsEditingName(false)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommitEditName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditingName(false)
    }
  }

  // Word selection handlers
  const handleWordSelect = (word: Word) => {
    setSelectedWord(word)
  }

  const handleWordSelectToggle = (wordId: string) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(wordId)) {
      newSelected.delete(wordId)
    } else {
      newSelected.add(wordId)
    }
    setSelectedWords(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedWords.size === words.length) {
      setSelectedWords(new Set())
    } else {
      setSelectedWords(new Set(words.map(w => w.id)))
    }
  }

  // Word update handlers
  const handleWordUpdate = (updatedWord: Word) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w))
    if (selectedWord?.id === updatedWord.id) {
      setSelectedWord(updatedWord)
    }
  }

  const handleWordEdit = (word: Word) => {
    setEditingWord(word)
    setIsEditModalOpen(true)
  }

  const handleWordDelete = async (word: Word) => {
    const confirmed = window.confirm(`Delete "${word.term}"?`)
    if (!confirmed) return

    try {
      await deleteWord(word.id)
      setWords(prev => prev.filter(w => w.id !== word.id))
      setSelectedWords(prev => {
        const newSet = new Set(prev)
        newSet.delete(word.id)
        return newSet
      })
      
      if (selectedWord?.id === word.id) {
        setSelectedWord(null)
      }
    } catch (error) {
      console.error('Failed to delete word:', error)
    }
  }

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedWords.size === 0) return
    
    const wordNames = words.filter(w => selectedWords.has(w.id)).map(w => w.term)
    const confirmed = window.confirm(
      `Delete ${selectedWords.size} word${selectedWords.size > 1 ? 's' : ''}?\n\n${wordNames.slice(0, 5).join(', ')}${wordNames.length > 5 ? ` and ${wordNames.length - 5} more...` : ''}`
    )
    if (!confirmed) return

    try {
      for (const wordId of selectedWords) {
        await deleteWord(wordId)
      }
      
      setWords(prev => prev.filter(w => !selectedWords.has(w.id)))
      setSelectedWords(new Set())
      
      if (selectedWord && selectedWords.has(selectedWord.id)) {
        setSelectedWord(null)
      }
    } catch (error) {
      console.error('Failed to delete words:', error)
    }
  }

  const handleBulkMove = () => {
    if (selectedWords.size === 0) return
    setIsMoveModalOpen(true)
  }

  const handleMoveToNewList = async (newListName: string) => {
    if (selectedWords.size === 0 || !newListName.trim()) return
    
    try {
      const newList = await createList(newListName.trim())
      const selectedWordObjects = words.filter(w => selectedWords.has(w.id))
      
      for (const word of selectedWordObjects) {
        await addWord(newList.id, word.term, word.transcription, word.definition)
        await deleteWord(word.id)
      }
      
      setWords(prev => prev.filter(w => !selectedWords.has(w.id)))
      setSelectedWords(new Set())
      setIsMoveModalOpen(false)
      
      if (selectedWord && selectedWords.has(selectedWord.id)) {
        setSelectedWord(null)
      }
    } catch (error) {
      console.error('Failed to move words:', error)
    }
  }

  const handleMoveToExistingList = async (targetListId: string) => {
    if (selectedWords.size === 0) return
    
    try {
      const selectedWordObjects = words.filter(w => selectedWords.has(w.id))
      
      for (const word of selectedWordObjects) {
        await addWord(targetListId, word.term, word.transcription, word.definition)
        await deleteWord(word.id)
      }
      
      setWords(prev => prev.filter(w => !selectedWords.has(w.id)))
      setSelectedWords(new Set())
      setIsMoveModalOpen(false)
      
      if (selectedWord && selectedWords.has(selectedWord.id)) {
        setSelectedWord(null)
      }
    } catch (error) {
      console.error('Failed to move words:', error)
    }
  }

  // Add word handler
  const handleWordAdded = (newWord: Word) => {
    setWords(prev => [newWord, ...prev])
  }

  return (
    <div className="page">
      {/* Header */}
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
              onBlur={handleCommitEditName}
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
              onClick={handleStartEditName}
            >
              {listName}
            </h1>
          )}
        </div>
        <div>
          <button className="create-btn" onClick={() => setIsAddModalOpen(true)}>
            Add Word +
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{ padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button 
            className="btn" 
            onClick={() => setActiveTab('list')} 
            style={{ borderColor: activeTab === 'list' ? '#646cff' : undefined }}
          >
            Word list
          </button>
          <button 
            className="btn" 
            onClick={() => setActiveTab('progress')} 
            style={{ borderColor: activeTab === 'progress' ? '#646cff' : undefined }}
          >
            Learning progress
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'list' ? (
        <div
          ref={containerRef}
          style={{
            display: 'grid',
            gridTemplateColumns: selectedWord ? `${panelWidth}px 6px 1fr` : '1fr',
          }}
        >
          {/* Word Details Panel */}
          {selectedWord && (
            <WordDetailsPanel
              selectedWord={selectedWord}
              onWordUpdate={handleWordUpdate}
              onClose={() => setSelectedWord(null)}
              panelWidth={panelWidth}
              onResizeStart={startResize}
            />
          )}

          {/* Main Content Area */}
          <div style={{ padding: '0 1.25rem' }}>
            <div style={{ marginBottom: '0.5rem', color: '#9aa0a6' }}>
              {words.length} words
            </div>
            
            {/* Bulk Actions Bar */}
            <BulkActionsBar
              selectedCount={selectedWords.size}
              onBulkDelete={handleBulkDelete}
              onBulkMove={handleBulkMove}
            />

            {/* Word Table */}
            <WordTable
              words={words}
              selectedWords={selectedWords}
              selectedWord={selectedWord}
              onWordSelect={handleWordSelect}
              onWordSelectToggle={handleWordSelectToggle}
              onSelectAll={handleSelectAll}
              onEditWord={handleWordEdit}
              onDeleteWord={handleWordDelete}
            />
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

      {/* Modals */}
      <AddWordModal
        isOpen={isAddModalOpen}
        listId={listId}
        onClose={() => setIsAddModalOpen(false)}
        onWordAdded={handleWordAdded}
      />

      {/* Move Words Modal */}
      {isMoveModalOpen && (
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
          onClick={() => setIsMoveModalOpen(false)}
        >
          <div
            style={{
              width: 'min(480px, 96vw)',
              background: '#121212',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              padding: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                Move {selectedWords.size} word{selectedWords.size > 1 ? 's' : ''}
              </h2>
              <button className="btn" onClick={() => setIsMoveModalOpen(false)}>✕</button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Move to existing list:</h3>
                {availableLists.length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {availableLists.map((list) => (
                      <button
                        key={list.id}
                        className="btn"
                        onClick={() => handleMoveToExistingList(list.id)}
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                      >
                        {list.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#9aa0a6', margin: 0 }}>No other lists available</p>
                )}
              </div>

              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Or create new list:</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    const newListName = formData.get('newListName') as string
                    await handleMoveToNewList(newListName)
                  }}
                  style={{ display: 'flex', gap: '0.5rem' }}
                >
                  <input
                    name="newListName"
                    placeholder="New list name"
                    required
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#1a1a1a',
                      color: 'inherit',
                    }}
                  />
                  <button type="submit" className="create-btn">
                    Create & Move
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


