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
      try {
        const newSentence = await addSentence(selectedWord!.id, text)
        setSentences(prev => prev.map((s, i) => i === index ? newSentence : s))
      } catch (error) {
        console.error('Failed to add sentence:', error)
      }
    }
  }

  if (!selectedWord) return null

  return (
    <>
      <aside style={{ 
        borderRight: '1px solid #2a2a2a', 
        padding: '0 1.25rem', 
        overflow: 'auto',
        width: panelWidth,
        position: 'relative'
      }}>
        <div style={{ padding: '0.75rem 0' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '0.5rem' 
          }}>
            <strong>Details</strong>
            <button className="btn" onClick={onClose}>✕</button>
          </div>

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
                  color: 'inherit' 
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
                  color: 'inherit' 
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
                  resize: 'vertical' 
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
              {Array.from({ length: 10 }).map((_, idx) => {
                const sentence = sentences[idx]
                return (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ color: '#9aa0a6', width: 18, marginTop: '0.5rem' }}>{idx + 1}.</span>
                    <textarea
                      value={sentence?.text ?? ''}
                      placeholder="Type a sentence"
                      rows={3}
                      onChange={(e) => {
                        const text = e.target.value
                        setSentences(prev => {
                          const next = [...prev]
                          if (sentence) {
                            next[idx] = { ...sentence, text }
                          } else {
                            next[idx] = { 
                              id: '', 
                              wordId: selectedWord.id, 
                              text, 
                              createdAt: Date.now() 
                            }
                          }
                          return next
                        })
                      }}
                      onBlur={(e) => handleSentenceUpdate(idx, e.target.value.trim())}
                      style={{ 
                        flex: 1, 
                        padding: '0.5rem 0.6rem', 
                        borderRadius: 8, 
                        border: '1px solid #3a3a3a', 
                        background: '#1a1a1a', 
                        color: 'inherit', 
                        resize: 'vertical' 
                      }}
                    />
                  </div>
                )
              })}
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
          position: 'relative',
          zIndex: 10
        }}
      />
    </>
  )
}
