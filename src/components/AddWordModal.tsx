import { useRef, useState, useEffect } from 'react'
import { addWord, addSentence, fetchCustomPhrases, type Word } from '../db'
import { autocompleteFromSentence, generateSentencesForWord, defineWordWithoutContext } from '../ai/gemini'
import { filterWatermark } from '../utils/textFilter'
import { getWordFrequency } from '../services/datamuseApi'

interface AddWordModalProps {
  isOpen: boolean
  listId: string
  onClose: () => void
  onWordAdded: (word: Word) => void
}

export default function AddWordModal({ 
  isOpen, 
  listId, 
  onClose, 
  onWordAdded 
}: AddWordModalProps) {
  const [wordText, setWordText] = useState('')
  const [wordSelection, setWordSelection] = useState<{ start: number; end: number } | null>(null)
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [generateMoreSentences, setGenerateMoreSentences] = useState(true)
  const [customPhrases, setCustomPhrases] = useState<string[]>([])
  const [frequency, setFrequency] = useState(50)
  const [isLoadingFrequency, setIsLoadingFrequency] = useState(false)
  const [frequencyInfo, setFrequencyInfo] = useState<{ category: string; description: string } | null>(null)

  const termRef = useRef<HTMLTextAreaElement | null>(null)
  const transcriptionRef = useRef<HTMLInputElement | null>(null)
  const definitionRef = useRef<HTMLTextAreaElement | null>(null)

  // Load custom phrases when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadCustomPhrases = async () => {
        try {
          const phrases = await fetchCustomPhrases()
          const phraseStrings = phrases.map(p => p.phrase)
          console.log('Loaded custom phrases in modal:', phraseStrings)
          setCustomPhrases(phraseStrings)
        } catch (error) {
          console.error('Failed to load custom phrases:', error)
          setCustomPhrases([])
        }
      }
      loadCustomPhrases()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = selectedTerm || termRef.current?.value?.trim()
    if (!term) return

    const transcription = transcriptionRef.current?.value?.trim() || null
    const definition = definitionRef.current?.value?.trim() || null
    
    try {
      // Fetch frequency data from Datamuse API
      setIsLoadingFrequency(true)
      const frequencyData = await getWordFrequency(term)
      setFrequency(frequencyData.frequency)
      setFrequencyInfo({
        category: frequencyData.category,
        description: frequencyData.description
      })
      setIsLoadingFrequency(false)
      
      const created = await addWord(listId, term, transcription, definition, frequencyData.frequency)
      
      // Save the original sentence if there's text and it's different from the selected term
      const originalSentence = wordText.trim() && wordText.trim() !== term ? wordText.trim() : null
      if (originalSentence) {
        await addSentence(created.id, originalSentence)
      }
      
      // Generate additional sentences if checkbox is checked
      if (generateMoreSentences) {
        try {
          setIsGeneratingAI(true)
          const sentenceCount = originalSentence ? 4 : 5
          const additionalSentences = await generateSentencesForWord({
            term,
            existingSentence: originalSentence || undefined,
            count: sentenceCount
          })
          
          // Save all generated sentences
          for (const sentence of additionalSentences) {
            await addSentence(created.id, sentence)
          }
        } catch (error) {
          console.error('Failed to generate additional sentences:', error)
        } finally {
          setIsGeneratingAI(false)
        }
      }
      
      onWordAdded(created)
      handleClose()
    } catch (error) {
      console.error('Failed to add word:', error)
    }
  }

  const handleClose = () => {
    setWordText('')
    setWordSelection(null)
    setSelectedTerm(null)
    setIsGeneratingAI(false)
    setFrequency(50)
    setFrequencyInfo(null)
    setIsLoadingFrequency(false)
    onClose()
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const originalValue = e.target.value
    console.log('Text change - custom phrases available:', customPhrases)
    const filteredValue = filterWatermark(originalValue, customPhrases)
    
    // Debug logging to verify filtering is working
    if (originalValue !== filteredValue) {
      console.log('Watermark filtering applied on text change:', {
        original: originalValue,
        filtered: filteredValue,
        customPhrases: customPhrases
      })
    }
    
    setWordText(filteredValue)
  }

  // Auto-fetch frequency when term is selected or entered
  const handleTermChange = async (newTerm: string) => {
    if (newTerm && newTerm.trim().length > 0) {
      setIsLoadingFrequency(true)
      try {
        const frequencyData = await getWordFrequency(newTerm.trim())
        setFrequency(frequencyData.frequency)
        setFrequencyInfo({
          category: frequencyData.category,
          description: frequencyData.description
        })
      } catch (error) {
        console.error('Failed to fetch frequency:', error)
        setFrequency(50)
        setFrequencyInfo(null)
      } finally {
        setIsLoadingFrequency(false)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    console.log('Paste event - custom phrases available:', customPhrases)
    const filteredText = filterWatermark(pastedText, customPhrases)
    
    // Debug logging to verify filtering is working
    if (pastedText !== filteredText) {
      console.log('Watermark filtering applied:', {
        original: pastedText,
        filtered: filteredText,
        customPhrases: customPhrases
      })
    }
    
    const target = e.target as HTMLTextAreaElement | HTMLInputElement
    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? 0
    
    // Handle different input types
    if (target === termRef.current) {
      const newText = wordText.slice(0, start) + filteredText + wordText.slice(end)
      setWordText(newText)
    } else if (target === transcriptionRef.current) {
      const currentValue = target.value
      const newText = currentValue.slice(0, start) + filteredText + currentValue.slice(end)
      target.value = newText
    } else if (target === definitionRef.current) {
      const currentValue = target.value
      const newText = currentValue.slice(0, start) + filteredText + currentValue.slice(end)
      target.value = newText
    }
    
    // Set cursor position after the pasted text
    setTimeout(() => {
      const newCursorPos = start + filteredText.length
      target.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? 0
    if (start !== end) {
      setWordSelection({ start, end })
      const selectedText = wordText.slice(start, end).trim()
      if (selectedText) {
        setSelectedTerm(selectedText)
        // Auto-fetch frequency for selected term
        handleTermChange(selectedText)
      }
    } else {
      setWordSelection(null)
      setSelectedTerm(null)
    }
  }

  const handleAIAutocomplete = async () => {
    if (isGeneratingAI) return
    
    const term = selectedTerm || wordText.trim()
    if (!term) return
    
    try {
      setIsGeneratingAI(true)
      
      if (selectedTerm && wordText.trim()) {
        // If there's a selected term and sentence context, use contextual definition
        const res = await autocompleteFromSentence({ term: selectedTerm, sentence: wordText.trim() })
        if (res.transcription && transcriptionRef.current) transcriptionRef.current.value = res.transcription
        if (res.definition && definitionRef.current) definitionRef.current.value = res.definition
      } else {
        // If it's just a word/phrase without sentence context, use general definition
        const res = await defineWordWithoutContext({ term })
        if (res.transcription && transcriptionRef.current) transcriptionRef.current.value = res.transcription
        if (res.definition && definitionRef.current) definitionRef.current.value = res.definition
      }
    } catch (err) {
      console.error('AI autocomplete failed', err)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
        overflow: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: 'min(560px, 96vw)',
          maxHeight: 'calc(100vh - 2rem)',
          background: '#121212',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          padding: '1rem',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Add Word</h2>
          <button className="btn" onClick={handleClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
          {/* Word/Sentence Input */}
          <div style={{ display: 'grid', gap: 6 }}>
            <span>Word/Sentence</span>
            <div style={{ 
              color: '#9aa0a6',
              fontSize: '0.9rem',
              minHeight: '2.5rem',
              display: 'flex',
              alignItems: 'center'
            }}>
              {(() => {
                const wordCount = wordText.trim().split(/\s+/).filter(word => word.length > 0).length
                const isSentence = wordCount > 5
                
                if (isSentence && !selectedTerm) {
                  return <>📝 <strong>Sentence detected</strong> - Select a word or phrase to define it, or use "Define with AI" to define the entire text</>
                } else if (selectedTerm) {
                  return <span style={{ color: '#4caf50' }}>✅ <strong>Will save:</strong> "{selectedTerm}"</span>
                } else if (wordCount > 0 && wordCount <= 5) {
                  return <span style={{ color: '#4caf50' }}>✅ <strong>Will save:</strong> "{wordText.trim()}"</span>
                } else {
                  return <span style={{ color: '#9aa0a6', fontStyle: 'italic' }}>Enter text above to see what will be saved</span>
                }
              })()}
            </div>
            <textarea
              ref={termRef}
              value={wordText}
              onChange={handleTextChange}
              onSelect={handleTextSelect}
              onPaste={handlePaste}
              required
              rows={4}
              placeholder="Paste a sentence or type text, then select a word/phrase to define"
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #3a3a3a',
                background: '#1a1a1a',
                color: 'inherit',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* AI Autocomplete */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            alignItems: 'center'
          }}>
            {(wordSelection && selectedTerm) || wordText.trim() ? (
              <>
                {wordSelection && selectedTerm ? (
                  <span style={{ color: '#9aa0a6', fontSize: '0.9rem' }}>
                    Selected: "<strong>{selectedTerm}</strong>"
                  </span>
                ) : (
                  <span style={{ color: '#9aa0a6', fontSize: '0.9rem' }}>
                    Word/Phrase: "<strong>{wordText.trim()}</strong>"
                  </span>
                )}
                <button
                  type="button"
                  className="create-btn"
                  disabled={isGeneratingAI}
                  onClick={handleAIAutocomplete}
                  style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                >
                  {isGeneratingAI ? '⏳ Generating...' : 'Define with AI'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={true}
                style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem', opacity: 0.5 }}
              >
                Define with AI
              </button>
            )}
          </div>

          {/* Watermark Filtering Info */}
          <div style={{ 
            padding: '0.5rem', 
            background: '#1a1a1a', 
            borderRadius: 6, 
            border: '1px solid #3a3a3a',
            color: '#9aa0a6',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>🛡️ Watermark filtering active</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
              (removes [brackets], (parentheses), watermark words, and custom phrases)
            </span>
          </div>

          {/* Generate Sentences Checkbox */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            padding: '0.5rem',
            background: '#1a1a1a',
            borderRadius: 6,
            border: '1px solid #3a3a3a'
          }}>
            <input
              type="checkbox"
              id="generate-sentences"
              checked={generateMoreSentences}
              onChange={(e) => setGenerateMoreSentences(e.target.checked)}
              style={{ margin: 0 }}
            />
            <label htmlFor="generate-sentences" style={{ 
              fontSize: '0.9rem', 
              color: '#9aa0a6',
              margin: 0,
              cursor: 'pointer'
            }}>
              Generate more sentences with this word
            </label>
          </div>

          {/* Transcription and Definition Fields */}
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Transcription</span>
            <input
              ref={transcriptionRef}
              placeholder="/trænˈskrɪpʃən/"
              onPaste={handlePaste}
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
                onPaste={handlePaste}
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

            <div style={{ display: 'grid', gap: 6 }}>
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
                  color: frequency >= 80 ? '#4caf50' : 
                         frequency >= 60 ? '#8bc34a' : 
                         frequency >= 40 ? '#ff9800' : 
                         frequency >= 20 ? '#f44336' : '#9e9e9e'
                }}>
                  {isLoadingFrequency ? '...' : frequency}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                    {isLoadingFrequency ? 'Loading...' :
                     frequencyInfo ? frequencyInfo.category :
                     frequency >= 80 ? 'Very Common' :
                     frequency >= 60 ? 'Common' :
                     frequency >= 40 ? 'Moderate' :
                     frequency >= 20 ? 'Uncommon' : 'Very Rare'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9aa0a6' }}>
                    {isLoadingFrequency ? 'Fetching from Datamuse API...' :
                     frequencyInfo ? frequencyInfo.description :
                     'Frequency data not available'}
                  </div>
                </div>
              </div>
              {frequencyInfo && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#4caf50',
                  fontStyle: 'italic',
                  padding: '0.25rem',
                  background: '#1a1a1a',
                  borderRadius: 4,
                  border: '1px solid #3a3a3a'
                }}>
                  📊 Automatically fetched from Datamuse API
                </div>
              )}
            </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button type="button" className="btn" onClick={handleClose} disabled={isGeneratingAI}>
              Cancel
            </button>
            <button type="submit" className="create-btn" disabled={isGeneratingAI || isLoadingFrequency}>
              {isGeneratingAI ? '⏳ Adding...' : isLoadingFrequency ? '⏳ Loading...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
