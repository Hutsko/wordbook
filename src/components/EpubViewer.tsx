import { useEffect, useRef, useState, useCallback } from 'react'
import Epub, { Rendition } from 'epubjs'
import { getReadingProgress, updateReadingProgress, saveReadingProgress } from '../db'

interface EpubViewerProps {
  fileId: string
  fileUrl: string
  fileName: string
  onClose: () => void
}

const THEMES = {
  light: {
    body: {
      'background': '#fff',
      'color': '#000',
      'line-height': '1.6',
    },
  },
  dark: {
    body: {
      'background': '#1a1a1a',
      'color': '#e0e0e0',
      'line-height': '1.6',
    },
  },
}

export default function EpubViewer({ fileId, fileUrl, fileName, onClose }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookReady, setIsBookReady] = useState(false)
  const [pageInfo, setPageInfo] = useState<{ currentPage: number, totalPages: number } | null>(null)
  const [fontSize, setFontSize] = useState<number>(() => {
    const savedSize = localStorage.getItem('epub-font-size')
    return savedSize ? parseInt(savedSize, 10) : 16
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('epub-theme')
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark'
  })

  useEffect(() => {
    let isCancelled = false

    if (!viewerRef.current) {
      return
    }

    let isInitialRender = true
    const book = new (Epub as any)(fileUrl, { openAs: 'epub' })
    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      allowScriptedContent: true,
    })

    Object.keys(THEMES).forEach(name => {
      rendition.themes.register(name, (THEMES as any)[name])
    })

    // Force line height override for all themes and book styles
    rendition.themes.override('line-height', '1.6', true)

    book.ready.then(() => {
      if (isCancelled) return
      return book.locations.generate(1650) // Generate locations based on a rough char count per page
    }).then(async () => {
      if (isCancelled) {
        return
      }
      
      const savedProgress = await getReadingProgress(fileId)

      rendition.on('relocated', (newLocation: any) => {
        if (!isCancelled) {
          const cfi = newLocation.start.cfi
          const progress = book.locations.percentageFromCfi(cfi)
          updateReadingProgress(fileId, cfi, progress).catch(err => {
            if (err.message.includes('404')) {
              saveReadingProgress(fileId, cfi, progress)
            }
          })
          const currentPage = book.locations.locationFromCfi(newLocation.start.cfi)
          const totalPages = book.locations.total
          setPageInfo({ currentPage, totalPages })
        }
      })

      rendition.on('displayed', () => {
        if (!isCancelled) {
          setIsLoading(false)
          setIsBookReady(true)
          if (isInitialRender) {
            // Set initial page info
            const currentLocation = rendition.currentLocation()
            const currentPage = book.locations.locationFromCfi(currentLocation.start.cfi)
            const totalPages = book.locations.total
            setPageInfo({ currentPage, totalPages })
            isInitialRender = false
          }
        }
      })

      rendition.on('displayError', (err: Error) => {
        if (!isCancelled) {
          setError(err.message)
        }
      });
      
      setRendition(rendition)
      
      rendition.display(savedProgress?.location).catch((err: Error) => {
        if (!isCancelled) {
          setError(err.message)
          setIsLoading(false)
        }
      })
    })

    return () => {
      isCancelled = true
      if (rendition) {
        rendition.destroy()
      }
      if (book) {
        book.destroy()
      }
    }
  }, [fileId, fileUrl])

  const nextPage = useCallback(() => {
    if (rendition && isBookReady) {
      rendition.next()
    }
  }, [rendition, isBookReady])

  const prevPage = useCallback(() => {
    if (rendition && isBookReady) {
      rendition.prev()
    }
  }, [rendition, isBookReady])

  useEffect(() => {
    localStorage.setItem('epub-font-size', String(fontSize))
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}px`)
    }
  }, [fontSize, rendition])

  useEffect(() => {
    localStorage.setItem('epub-theme', theme)
    if (rendition) {
      rendition.themes.default(THEMES[theme])
    }
  }, [theme, rendition])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        prevPage()
      } else if (event.key === 'ArrowRight') {
        nextPage()
      }
    }

    // Attach to main window
    window.addEventListener('keydown', handleKeyDown)
    // Attach to rendition iframe
    if (rendition) {
      rendition.on('keydown', handleKeyDown)
    }

    return () => {
      // Clean up from both
      window.removeEventListener('keydown', handleKeyDown)
      if (rendition) {
        // The .off method exists on the Emitter mixin, even if not in all type defs
        ;(rendition as any).off('keydown', handleKeyDown)
      }
    }
  }, [rendition, prevPage, nextPage])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 2000,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        background: '#2a2a2a',
        borderBottom: '1px solid #3a3a3a',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📖 {fileName}</h2>
          {/* Font Size Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>Font:</span>
            <button
              className="btn"
              onClick={() => setFontSize(s => Math.max(12, s - 1))}
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
              disabled={!isBookReady}
            >
              A-
            </button>
            <span style={{ fontSize: '0.9rem', minWidth: '2rem', textAlign: 'center' }}>
              {fontSize}px
            </span>
            <button
              className="btn"
              onClick={() => setFontSize(s => Math.min(32, s + 1))}
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
              disabled={!isBookReady}
            >
              A+
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            className="btn"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
            disabled={!isBookReady}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
        <div>
          <button className="btn" onClick={prevPage} style={{ marginRight: '1rem' }} disabled={!isBookReady}>
            ‹ Prev
          </button>
          <button className="btn" onClick={nextPage} disabled={!isBookReady}>
            Next ›
          </button>
        </div>
        <button
          className="btn"
          onClick={onClose}
          style={{ fontSize: '1.2rem', padding: '0.5rem' }}
        >
          ← Back
        </button>
      </div>

      {/* Content Area */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'hidden',
        background: theme === 'dark' ? '#1a1a1a' : '#00000000'
      }}>
        <div ref={viewerRef} style={{ height: '100%', background: theme === 'dark' ? '#1a1a1a' : '#fff' }} />

        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: theme === 'dark' ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme === 'dark' ? 'white' : 'black',
            fontSize: '1.2rem'
          }}>
            Loading Book...
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: theme === 'dark' ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ff4444',
            textAlign: 'center',
            padding: '2rem'
          }}>
            <div>
              <div style={{ marginBottom: '1rem' }}>Error loading book:</div>
              <div>{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: '#2a2a2a',
        padding: '0.5rem 1rem',
        textAlign: 'center',
        color: 'white',
        borderTop: '1px solid #3a3a3a',
        fontSize: '0.9rem',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {pageInfo ? (
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
