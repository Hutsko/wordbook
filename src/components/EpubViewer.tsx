import { useEffect, useRef, useState, useCallback } from 'react'
import Epub, { Rendition } from 'epubjs'
import { getReadingProgress, updateReadingProgress, saveReadingProgress } from '../db'

interface EpubViewerProps {
  fileId: string
  fileUrl: string
  fileName: string
  onClose: () => void
}

export default function EpubViewer({ fileId, fileUrl, fileName, onClose }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookReady, setIsBookReady] = useState(false)
  const [pageInfo, setPageInfo] = useState<{ currentPage: number, totalPages: number } | null>(null)

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        prevPage()
      } else if (event.key === 'ArrowRight') {
        nextPage()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [prevPage, nextPage])

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
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📖 {fileName}</h2>
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
        background: '#1a1a1a'
      }}>
        <div ref={viewerRef} style={{ height: '100%' }} />

        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(26, 26, 26, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.2rem'
          }}>
            Loading Book...
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(26, 26, 26, 0.8)',
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
