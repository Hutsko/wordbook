import { useState, useEffect } from 'react'
import type { HighlightRecord } from '../../db'

interface EpubSidebarProps {
  fileName: string
  isBookReady: boolean
  fontSize: number
  theme: 'light' | 'dark'
  currentSelection: { cfiRange: string; contents: any } | null
  selectedHighlightText: string | null
  activeHighlight: HighlightRecord | null
  pageInfo: { currentPage: number, totalPages: number } | null
  isLoading: boolean
  onClose: () => void
  onNextPage: () => void
  onPrevPage: () => void
  onFontSizeChange: (size: number) => void
  onThemeChange: (theme: 'light' | 'dark') => void
  onCloseHighlightPanel: () => void
  onDeleteHighlight: () => void
  onNoteChange: (note: string) => void
}

export function EpubSidebar({
  fileName,
  isBookReady,
  fontSize,
  theme,
  currentSelection,
  selectedHighlightText,
  activeHighlight,
  pageInfo,
  isLoading,
  onClose,
  onNextPage,
  onPrevPage,
  onFontSizeChange,
  onThemeChange,
  onCloseHighlightPanel,
  onDeleteHighlight,
  onNoteChange,
}: EpubSidebarProps) {
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (activeHighlight) {
      setNote(activeHighlight.note || '')
    }
  }, [activeHighlight])

  const handleSaveNote = () => {
    console.log('[DEBUG] Save Note clicked. Current note state:', note);
    setIsSaving(true)
    onNoteChange(note)
    setTimeout(() => setIsSaving(false), 1000) // Simulate save delay
  }

  return (
    <div style={{
      width: '280px',
      background: '#2a2a2a',
      color: 'white',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #3a3a3a',
      overflowY: 'auto',
    }}>
      <button
        className="btn"
        onClick={onClose}
        style={{ fontSize: '1rem', padding: '0.5rem', marginBottom: '1.5rem', textAlign: 'left' }}
      >
        ← Back to Library
      </button>

      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📖 {fileName}</h2>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: '#aaa' }}>View Settings</h3>
        {/* Font Size Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.9rem', flex: 1 }}>Font Size:</span>
          <button
            className="btn"
            onClick={() => onFontSizeChange(Math.max(12, fontSize - 1))}
            style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
            disabled={!isBookReady}
          >
            A-
          </button>
          <span style={{ fontSize: '0.9rem', minWidth: '2.5rem', textAlign: 'center' }}>
            {fontSize}px
          </span>
          <button
            className="btn"
            onClick={() => onFontSizeChange(Math.min(32, fontSize + 1))}
            style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
            disabled={!isBookReady}
          >
            A+
          </button>
        </div>
        {/* Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', flex: 1 }}>Theme:</span>
          <button
            className="btn"
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', width: '100px' }}
            disabled={!isBookReady}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: '#aaa' }}>Navigation</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn" onClick={onPrevPage} style={{ flex: 1, marginRight: '0.5rem' }} disabled={!isBookReady}>
            ‹ Prev
          </button>
          <button className="btn" onClick={onNextPage} style={{ flex: 1 }} disabled={!isBookReady}>
            Next ›
          </button>
        </div>
      </div>

      {currentSelection && !selectedHighlightText && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Press <kbd>Shift</kbd> + <kbd>H</kbd> to highlight.</p>
        </div>
      )}

      {selectedHighlightText && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: '#aaa' }}>Highlight</h3>
            <button onClick={onCloseHighlightPanel} className="btn" style={{ fontSize: '0.8rem', padding: '0.1rem 0.3rem' }}>×</button>
          </div>
          <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap', fontStyle: 'italic', maxHeight: '150px', overflowY: 'auto' }}>
            "{selectedHighlightText}"
          </p>

          <div style={{ marginTop: '1rem' }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              style={{
                width: '100%',
                minHeight: '60px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid #555',
                borderRadius: '4px',
                color: 'white',
                padding: '0.5rem',
                fontSize: '0.9rem',
                resize: 'vertical'
              }}
            />
            <button
              onClick={handleSaveNote}
              className="btn"
              disabled={isSaving}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                fontSize: '0.8rem',
                padding: '0.3rem',
                background: isSaving ? '#555' : '#4CAF50',
                color: 'white',
                border: 'none',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>

          <button
            onClick={onDeleteHighlight}
            className="btn btn-danger"
            style={{ marginTop: '1rem', width: '100%', fontSize: '0.8rem', padding: '0.3rem' }}
          >
            Delete Highlight
          </button>
        </div>
      )}

      <div style={{ marginTop: 'auto', fontSize: '0.9rem', color: '#aaa', textAlign: 'center' }}>
        {isLoading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="spinner" />
            Loading Book...
          </span>
        ) : pageInfo ? (
          <span>
            Page {pageInfo.currentPage} of {pageInfo.totalPages}
          </span>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
    </div>
  )
}
