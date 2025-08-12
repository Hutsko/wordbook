import { useRef, useState, useEffect } from 'react'
import { updateWord, fetchSentences, addSentence, updateSentence, deleteSentence, type Word, type Sentence } from '../db'
import { getWordFrequency } from '../services/datamuseApi'

interface WordDetailsPanelProps {
  selectedWord: Word | null
  onWordUpdate: (updatedWord: Word) => void
  onClose: () => void
  panelWidth: number
  onResizeStart: () => void
}

export default function WordDetailsPanel({ 
  selectedWord, 
  onWordUpdate, 
  onClose, 
  panelWidth, 
  onResizeStart 
}: WordDetailsPanelProps) {
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [isLoadingSentences, setIsLoadingSentences] = useState(false)
  const [frequencyInfo, setFrequencyInfo] = useState<{ category: string; description: string } | null>(null)
  const [editingSentenceIndex, setEditingSentenceIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  // Load sentences when word is selected
  useEffect(() => {
    if (selectedWord) {
      loadSentences(selectedWord.id)
    }
  }, [selectedWord?.id])

  const loadSentences = async (wordId: string) => {
    setIsLoadingSentences(true)
    try {
      const fetchedSentences = await fetchSentences(wordId)
      setSentences(fetchedSentences)
    } catch (error) {
      console.error('Failed to load sentences:', error)
      setSentences([])
    } finally {
      setIsLoadingSentences(false)
    }
  }

  // Update word in database and local state
  const handleWordUpdate = async (field: keyof Word, value: string | null | number) => {
    if (!selectedWord) return

    const updatedWord = { ...selectedWord, [field]: value }
    
    try {
      await updateWord(
        selectedWord.id, 
        updatedWord.term, 
        updatedWord.transcription, 
        updatedWord.definition,
        field === 'frequency' ? value as number : undefined
      )
      onWordUpdate(updatedWord)
    } catch (error) {
      console.error('Failed to update word:', error)
    }
  }

  // Handle sentence updates
  const handleSentenceUpdate = async (index: number, text: string) => {
    const currentSentence = sentences[index]
    
    if (!text.trim()) {
      if (currentSentence?.id) {
        try {
          await deleteSentence(currentSentence.id)
          setSentences(prev => prev.filter((_, i) => i !== index))
        } catch (error) {
          console.error('Failed to delete sentence:', error)
        }
      }
      return
    }

    if (currentSentence?.id) {
      try {
        await updateSentence(currentSentence.id, text)
        setSentences(prev => prev.map((s, i) => i === index ? { ...s, text } : s))
      } catch (error) {
        console.error('Failed to update sentence:', error)
      }
    } else {
      // Adding a new sentence - append to the end
      try {
        const newSentence = await addSentence(selectedWord!.id, text)
        setSentences(prev => [...prev, newSentence])
      } catch (error) {
        console.error('Failed to add sentence:', error)
      }
    }
  }

  // Start editing a sentence
  const startEditing = (index: number, text: string) => {
    setEditingSentenceIndex(index)
    setEditingText(text)
  }

  // Save edited sentence
  const saveEdit = async () => {
    if (editingSentenceIndex === null) return
    
    await handleSentenceUpdate(editingSentenceIndex, editingText.trim())
    setEditingSentenceIndex(null)
    setEditingText('')
    
    // Reset text color to white for the sentence that was being edited
    const sentenceElement = document.querySelector(`[data-sentence-index="${editingSentenceIndex}"]`) as HTMLElement
    if (sentenceElement) {
      sentenceElement.style.color = 'white'
    }
  }

  // Delete a sentence
  const deleteSentenceHandler = async (index: number) => {
    const sentence = sentences[index]
    if (sentence?.id) {
      try {
        await deleteSentence(sentence.id)
        setSentences(prev => prev.filter((_, i) => i !== index))
      } catch (error) {
        console.error('Failed to delete sentence:', error)
      }
    }
  }

  // Discard edit
  const discardEdit = () => {
    setEditingSentenceIndex(null)
    setEditingText('')
    
    // Reset text color to white for the sentence that was being edited
    const sentenceElement = document.querySelector(`[data-sentence-index="${editingSentenceIndex}"]`) as HTMLElement
    if (sentenceElement) {
      sentenceElement.style.color = 'white'
    }
  }

  if (!selectedWord) return null

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ 
        borderRight: '1px solid #2a2a2a', 
        width: panelWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}>
        {/* Fixed Header */}
        <div style={{ 
          padding: '0.75rem 1.25rem 0.5rem 1.25rem',
          borderBottom: '1px solid #2a2a2a',
          flexShrink: 0
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <strong>Details</strong>
            <button className="btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ 
          padding: '1rem 1.25rem 2rem 1.25rem',
          overflowY: 'auto',
          flex: 1
        }}>

          {/* Word Form */}
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Word</span>
              <input
                value={selectedWord.term}
                onChange={(e) => {
                  const updatedWord = { ...selectedWord, term: e.target.value }
                  onWordUpdate(updatedWord)
                }}
                onBlur={(e) => handleWordUpdate('term', e.target.value)}
                style={{ 
                  padding: '0.6rem 0.75rem', 
                  borderRadius: 8, 
                  border: '1px solid #3a3a3a', 
                  background: '#1a1a1a', 
                  color: 'inherit',
                  fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Transcription</span>
              <input
                value={selectedWord.transcription ?? ''}
                onChange={(e) => {
                  const updatedWord = { ...selectedWord, transcription: e.target.value }
                  onWordUpdate(updatedWord)
                }}
                onBlur={(e) => handleWordUpdate('transcription', e.target.value || null)}
                style={{ 
                  padding: '0.6rem 0.75rem', 
                  borderRadius: 8, 
                  border: '1px solid #3a3a3a', 
                  background: '#1a1a1a', 
                  color: 'inherit',
                  fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, marginTop: '0.75rem' }}>
              <span>Definition</span>
              <textarea
                value={selectedWord.definition ?? ''}
                onChange={(e) => {
                  const updatedWord = { ...selectedWord, definition: e.target.value }
                  onWordUpdate(updatedWord)
                }}
                onBlur={(e) => handleWordUpdate('definition', e.target.value || null)}
                rows={5}
                style={{ 
                  padding: '0.6rem 0.75rem', 
                  borderRadius: 8, 
                  border: '1px solid #3a3a3a', 
                  background: '#1a1a1a', 
                  color: 'inherit', 
                  resize: 'vertical',
                  fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                }}
              />
            </label>

            <div style={{ display: 'grid', gap: 6, marginTop: '0.75rem' }}>
              <span>Frequency</span>
              <div style={{ 
                padding: '0.75rem',
                background: '#1a1a1a',
                borderRadius: 8,
                border: '1px solid #3a3a3a',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ 
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: selectedWord.frequency >= 80 ? '#4caf50' : 
                         selectedWord.frequency >= 60 ? '#8bc34a' : 
                         selectedWord.frequency >= 40 ? '#ff9800' : 
                         selectedWord.frequency >= 20 ? '#f44336' : '#9e9e9e'
                }}>
                  {selectedWord.frequency}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                    {selectedWord.frequency >= 80 ? 'Very Common' :
                     selectedWord.frequency >= 60 ? 'Common' :
                     selectedWord.frequency >= 40 ? 'Moderate' :
                     selectedWord.frequency >= 20 ? 'Uncommon' : 'Very Rare'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9aa0a6' }}>
                    Automatically fetched from Datamuse API
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sentences Section */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
              Sentences (up to 10)
              {isLoadingSentences && <span style={{ color: '#9aa0a6', fontWeight: 'normal' }}> - Loading...</span>}
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {sentences.map((sentence, idx) => {
                const isEditing = editingSentenceIndex === idx
                
                return (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ color: '#9aa0a6', width: 18, marginTop: '0.5rem' }}>{idx + 1}.</span>
                    
                    {isEditing ? (
                      <div style={{ flex: 1, display: 'grid', gap: '0.5rem' }}>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          placeholder="Type a sentence"
                          style={{ 
                            padding: '0.5rem 0.6rem', 
                            borderRadius: 8, 
                            border: '1px solid #3a3a3a', 
                            background: '#1a1a1a', 
                            color: 'white', 
                            resize: 'vertical',
                            fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                          }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            type="button" 
                            className="btn" 
                            onClick={discardEdit}
                            style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem', color: 'white' }}
                          >
                            Discard
                          </button>
                          <button 
                            type="button" 
                            className="create-btn" 
                            onClick={saveEdit}
                            style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem', color: 'white' }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        data-sentence-index={idx}
                        style={{ 
                          flex: 1, 
                          padding: '0.5rem 0', 
                          cursor: 'pointer',
                          borderRadius: 4,
                          transition: 'color 0.2s ease',
                          fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#9aa0a6'
                          // Show delete button on hover
                          const deleteBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement
                          if (deleteBtn) deleteBtn.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'white'
                          // Hide delete button on leave
                          const deleteBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement
                          if (deleteBtn) deleteBtn.style.opacity = '0'
                        }}
                        onClick={() => startEditing(idx, sentence.text)}
                      >
                        {sentence.text}
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSentenceHandler(idx)
                          }}
                          style={{
                            position: 'absolute',
                            right: '0.5rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                            zIndex: 10
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              
              {/* Add new sentence button */}
              {editingSentenceIndex === sentences.length ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#9aa0a6', width: 18, marginTop: '0.5rem' }}>
                    {sentences.length + 1}.
                  </span>
                  <div style={{ flex: 1, display: 'grid', gap: '0.5rem' }}>
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={3}
                      placeholder="Type a sentence"
                      style={{ 
                        padding: '0.5rem 0.6rem', 
                        borderRadius: 8, 
                        border: '1px solid #3a3a3a', 
                        background: '#1a1a1a', 
                        color: 'white', 
                        resize: 'vertical',
                        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={discardEdit}
                        style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem', color: 'white' }}
                      >
                        Discard
                      </button>
                      <button 
                        type="button" 
                        className="create-btn" 
                        onClick={saveEdit}
                        style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem', color: 'white' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#9aa0a6', width: 18, marginTop: '0.5rem' }}>
                    {sentences.length + 1}.
                  </span>
                  <div 
                    style={{ 
                      flex: 1, 
                      padding: '0.5rem 0', 
                      cursor: 'pointer',
                      borderRadius: 4,
                      transition: 'color 0.2s ease',
                      color: '#9aa0a6',
                      fontStyle: 'italic',
                      fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#6c757d'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#9aa0a6'
                    }}
                    onClick={() => startEditing(sentences.length, '')}
                  >
                    Click to add a sentence
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        style={{ 
          cursor: 'col-resize', 
          background: '#2a2a2a', 
          width: 6,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{
          width: 2,
          height: 40,
          background: '#4a4a4a',
          borderRadius: 1
        }} />
      </div>
    </div>
  )
}
