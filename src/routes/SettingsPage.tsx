import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { filterWatermark, getWatermarkPreview, DEFAULT_CUSTOM_PHRASES } from '../utils/textFilter'
import { fetchCustomPhrases, addCustomPhrase, deleteCustomPhrase, clearAllCustomPhrases } from '../db'

export default function SettingsPage() {
  const [previewText, setPreviewText] = useState('To be only a bit facetious, stress physiology exists as a discipline because this man was both a very insightful scientist and lame at handling lab rats.\n\nExcerpt From\nWhy Zebras Don\'t Get Ulcers, Third Edition: The Acclaimed Guide to Stress, Stress-Related Diseases, and Coping - Now Revised and Updated\nRobert M. Sapolsky\nThis material may be protected by copyright.')
  const [customPhrases, setCustomPhrases] = useState<string[]>(DEFAULT_CUSTOM_PHRASES)
  const [customPhrasesWithIds, setCustomPhrasesWithIds] = useState<{ id: string; phrase: string; createdAt: number }[]>([])
  const [newPhrase, setNewPhrase] = useState('')
  const [previewResult, setPreviewResult] = useState(() => getWatermarkPreview(previewText, customPhrases))
  const [isLoading, setIsLoading] = useState(true)

  // Load custom phrases from database on component mount
  useEffect(() => {
    const loadCustomPhrases = async () => {
      try {
        const phrases = await fetchCustomPhrases()
        setCustomPhrasesWithIds(phrases)
        const phraseStrings = phrases.map(p => p.phrase)
        // Only DB-backed phrases; defaults are seeded server-side
        setCustomPhrases(phraseStrings)
        setPreviewResult(getWatermarkPreview(previewText, phraseStrings))
      } catch (error) {
        console.error('Failed to load custom phrases:', error)
        setCustomPhrases([])
        setPreviewResult(getWatermarkPreview(previewText, []))
      } finally {
        setIsLoading(false)
      }
    }
    loadCustomPhrases()
  }, [])

  const handlePreviewChange = (text: string) => {
    setPreviewText(text)
    setPreviewResult(getWatermarkPreview(text, customPhrases))
  }

  const handleAddPhrase = async () => {
    if (newPhrase.trim() && !customPhrases.includes(newPhrase.trim())) {
      try {
        await addCustomPhrase(newPhrase.trim())
        const updatedPhrases = [...customPhrases, newPhrase.trim()]
        setCustomPhrases(updatedPhrases)
        setNewPhrase('')
        setPreviewResult(getWatermarkPreview(previewText, updatedPhrases))
        
        // Refresh the phrases with IDs
        const phrases = await fetchCustomPhrases()
        setCustomPhrasesWithIds(phrases)
      } catch (error) {
        console.error('Failed to add phrase:', error)
        alert('Failed to add phrase. It might already exist.')
      }
    }
  }

  const handleRemovePhrase = async (phraseToRemove: string) => {
    try {
      const phraseToDelete = customPhrasesWithIds.find(p => p.phrase === phraseToRemove)
      if (phraseToDelete) {
        await deleteCustomPhrase(phraseToDelete.id)
        const updatedPhrases = customPhrases.filter(phrase => phrase !== phraseToRemove)
        setCustomPhrases(updatedPhrases)
        setPreviewResult(getWatermarkPreview(previewText, updatedPhrases))
        
        // Refresh the phrases with IDs
        const phrases = await fetchCustomPhrases()
        setCustomPhrasesWithIds(phrases)
      }
    } catch (error) {
      console.error('Failed to remove phrase:', error)
      alert('Failed to remove phrase.')
    }
  }

  const handleResetPhrases = async () => {
    try {
      await clearAllCustomPhrases()
      setCustomPhrases([])
      setCustomPhrasesWithIds([])
      setPreviewResult(getWatermarkPreview(previewText, []))
    } catch (error) {
      console.error('Failed to reset phrases:', error)
      alert('Failed to reset phrases.')
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/" className="btn" style={{ textDecoration: 'none' }}>
            ← Back
          </Link>
          <h1 className="title" style={{ margin: 0 }}>
            Settings
          </h1>
        </div>
      </header>

      <div style={{ padding: '0 1.25rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Watermark Filtering Section */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>🛡️ Watermark Filtering</h2>
            
            <div style={{ 
              background: '#1a1a1a', 
              borderRadius: 8, 
              padding: '1rem', 
              border: '1px solid #3a3a3a',
              marginBottom: '1rem'
            }}>
              <p style={{ margin: '0 0 1rem 0', color: '#9aa0a6' }}>
                Watermark filtering automatically removes common watermark patterns from text when adding words.
                This helps clean up copied text from documents, PDFs, and other sources.
              </p>
              
              <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50' }}>✅</span>
                  <span>Text in square brackets: <code>[watermark]</code></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50' }}>✅</span>
                  <span>Text in parentheses: <code>(confidential)</code></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50' }}>✅</span>
                  <span>Watermark words: <code>draft, copy, sample, confidential, private, internal</code></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50' }}>✅</span>
                  <span>Copyright notices: <code>2024 © Company</code></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50' }}>✅</span>
                  <span>Document codes: <code>DOC-2024</code></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50' }}>✅</span>
                  <span>Custom phrases: <code>Excerpt From, This material may be protected by copyright.</code></span>
                </div>
              </div>
            </div>

            {/* Custom Phrases Management */}
            <div style={{ 
              background: '#1a1a1a', 
              borderRadius: 8, 
              padding: '1rem', 
              border: '1px solid #3a3a3a',
              marginBottom: '1rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Custom Phrases to Remove</h3>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Add new phrase */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                    placeholder="Enter a phrase to remove (e.g., 'Excerpt From')"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddPhrase()
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#121212',
                      color: 'inherit',
                    }}
                  />
                  <button 
                    onClick={handleAddPhrase}
                    disabled={!newPhrase.trim()}
                    className="create-btn"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Add Phrase
                  </button>
                </div>

                {/* Current phrases */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#9aa0a6' }}>
                      {customPhrases.length} phrase{customPhrases.length !== 1 ? 's' : ''} configured
                    </span>
                    <button 
                      onClick={handleResetPhrases}
                      className="btn"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    >
                      Reset to Defaults
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {customPhrases.map((phrase, index) => (
                      <div 
                        key={index}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '0.5rem',
                          background: '#121212',
                          borderRadius: 6,
                          border: '1px solid #2a2a2a'
                        }}
                      >
                        <span style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{phrase}</span>
                        <button
                          onClick={() => handleRemovePhrase(phrase)}
                          className="btn danger"
                          style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', marginLeft: '0.5rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div style={{ 
              background: '#1a1a1a', 
              borderRadius: 8, 
              padding: '1rem', 
              border: '1px solid #3a3a3a'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Preview Watermark Filtering</h3>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Test Text:
                  </label>
                  <textarea
                    value={previewText}
                    onChange={(e) => handlePreviewChange(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#121212',
                      color: 'inherit',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                    placeholder="Enter text with watermarks to see how filtering works..."
                  />
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#9aa0a6' }}>
                      Original Text:
                    </label>
                    <div style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#121212',
                      color: '#9aa0a6',
                      minHeight: '2.5rem',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {previewResult.original || '(empty)'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#4caf50' }}>
                      Filtered Text:
                    </label>
                    <div style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      background: '#121212',
                      color: '#4caf50',
                      minHeight: '2.5rem',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {previewResult.filtered || '(empty)'}
                    </div>
                  </div>

                  {previewResult.removed.length > 0 && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#ff9800' }}>
                        Removed Items:
                      </label>
                      <div style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #3a3a3a',
                        background: '#121212',
                        color: '#ff9800',
                        minHeight: '2.5rem'
                      }}>
                        {previewResult.removed.map((item, index) => (
                          <div key={index} style={{ marginBottom: '0.25rem' }}>
                            • {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Other Settings Sections */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>⚙️ General Settings</h2>
            <div style={{ 
              background: '#1a1a1a', 
              borderRadius: 8, 
              padding: '1rem', 
              border: '1px solid #3a3a3a'
            }}>
              <p style={{ margin: 0, color: '#9aa0a6' }}>
                More settings coming soon...
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
