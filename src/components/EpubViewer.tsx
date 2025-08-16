import { useEffect, useRef, useState } from 'react'
import { Book, Rendition } from 'epubjs'
import JSZip from 'jszip'
import { getReadingProgress, saveReadingProgress, updateReadingProgress } from '../db'

interface EpubViewerProps {
  fileId: string
  fileUrl: string
  fileName: string
  onClose: () => void
}

export default function EpubViewer({ fileId, fileUrl, fileName, onClose }: EpubViewerProps) {
  console.log('EpubViewer mounted with:', { fileId, fileUrl, fileName })
  const viewerRef = useRef<HTMLDivElement>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [currentLocation, setCurrentLocation] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(16)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [isLoadingBook, setIsLoadingBook] = useState(false)
  const [readingProgress, setReadingProgress] = useState<{ location: string; progress: number } | null>(null)

  // Function to save reading progress
  const saveReadingProgressOnLocationChange = async (location: any) => {
    try {
      const locationHref = location.start.href
      const progress = location.start.percentage || 0
      
      // Try to update existing progress first, if that fails, create new
      try {
        await updateReadingProgress(fileId, locationHref, progress)
        console.log('Updated reading progress:', { location: locationHref, progress })
      } catch (err) {
        // If update fails (e.g., no existing record), create new
        await saveReadingProgress(fileId, locationHref, progress)
        console.log('Created new reading progress:', { location: locationHref, progress })
      }
      
      setReadingProgress({ location: locationHref, progress })
    } catch (err) {
      console.error('Failed to save reading progress:', err)
    }
  }

  // Make JSZip available globally for EPUB.js
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).JSZip = JSZip
    }
  }, [])

  // Load reading progress and book together
  useEffect(() => {
    console.log('EpubViewer useEffect triggered with fileId:', fileId, 'fileUrl:', fileUrl)
    const loadReadingProgressAndBook = async () => {
      if (!viewerRef.current) {
        console.log('viewerRef.current is null, returning')
        return
      }

      // Clean up any existing rendition first
      if (rendition) {
        console.log('Destroying existing rendition...')
        rendition.destroy()
        setRendition(null)
      }

      // Clear the viewer container
      if (viewerRef.current) {
        console.log('Clearing viewer container...')
        viewerRef.current.innerHTML = ''
      }

      // Load reading progress first
      let savedProgress: { location: string; progress: number } | null = null
      try {
        const progress = await getReadingProgress(fileId)
        if (progress) {
          savedProgress = {
            location: progress.location,
            progress: progress.progress
          }
          setReadingProgress(savedProgress)
          console.log('Loaded reading progress:', progress)
        }
      } catch (err) {
        console.error('Failed to load reading progress:', err)
      }

      // Then load the book
      const loadBook = async () => {
        if (isLoadingBook) {
          console.log('Already loading a book, skipping...')
          return
        }
        
        try {
          setIsLoadingBook(true)
          setIsLoading(true)
          setError(null)

          console.log('Loading EPUB from:', fileUrl)
          
          // Try to load the EPUB
          let newBook: Book
          try {
            const response = await fetch(fileUrl)
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            const blob = await response.blob()
            console.log('Blob created, size:', blob.size)
            
            // Check if it's a ZIP file
            if (fileUrl.includes('.zip')) {
              console.log('Detected ZIP file, extracting in browser...')
              const JSZip = (window as any).JSZip
              const zip = new JSZip()
              const zipContent = await zip.loadAsync(blob)
              
              // Find the EPUB directory
              const epubDir = Object.keys(zipContent.files).find(file => 
                file.endsWith('.epub/') && (zipContent.files[file] as any).dir
              )
              
              if (epubDir) {
                console.log('Found EPUB directory:', epubDir)
                // Create a new ZIP with just the EPUB content
                const epubZip = new JSZip()
                
                // Copy all files from the EPUB directory to the root of the new ZIP
                for (const [filePath, file] of Object.entries(zipContent.files)) {
                  if (filePath.startsWith(epubDir) && !(file as any).dir) {
                    const relativePath = filePath.substring(epubDir.length)
                    epubZip.file(relativePath, file as any)
                  }
                }
                
                // Generate the EPUB blob
                const epubBlob = await epubZip.generateAsync({ type: 'blob' })
                console.log('Created EPUB blob, size:', epubBlob.size)
                
                newBook = new Book(epubBlob as any, {
                  openAs: 'epub'
                })
              } else {
                throw new Error('No EPUB directory found in ZIP')
              }
            } else {
              newBook = new Book(blob as any, {
                openAs: 'epub'
              })
            }
            
            // Wait for the book to be ready
            await newBook.ready
            console.log('Book ready')
          } catch (err) {
            console.warn('Failed to load as blob, trying direct URL:', err)
            newBook = new Book(fileUrl, {
              openAs: 'epub'
            })
            // Wait for the book to be ready
            await newBook.ready
            console.log('Book ready from direct URL')
          }

          console.log('Book loaded successfully, creating rendition...')
          
          // Create rendition
          const newRendition = newBook.renderTo(viewerRef.current!, {
            width: '100%',
            height: '100%',
            flow: 'paginated',
            manager: 'default'
          })
          console.log('Rendition created successfully')

          // Set theme
          newRendition.themes.default({
            body: {
              'font-family': 'Georgia, serif',
              'font-size': `${fontSize}px`,
              'line-height': '1.6',
              'color': theme === 'dark' ? '#e0e0e0' : '#333333',
              'background-color': theme === 'dark' ? '#1a1a1a' : '#ffffff',
              'padding': '20px',
              'margin': '0',
              'overflow': 'hidden'
            },
            'h1, h2, h3, h4, h5, h6': {
              'color': theme === 'dark' ? '#ffffff' : '#000000',
              'margin-top': '1.5em',
              'margin-bottom': '0.5em'
            },
            'p': {
              'margin-bottom': '1em',
              'text-align': 'justify'
            },
            '.epub-container': {
              'overflow': 'hidden'
            },
            '.epub-view': {
              'overflow': 'hidden'
            },
            '.epub-view > div': {
              'margin-top': '0 !important',
              'padding-top': '0 !important'
            },
            '.epub-view iframe': {
              'margin': '0 !important',
              'padding': '0 !important',
              'border': 'none !important'
            },
            '.epub-view iframe body': {
              'margin': '0 !important',
              'padding': '0 !important'
            }
          })

          // Set up location change listener
          newRendition.on('relocated', (location: any) => {
            setCurrentLocation(location.start.href)
            // Save reading progress when location changes
            saveReadingProgressOnLocationChange(location)
          })

          setBook(newBook)
          setRendition(newRendition)
          setIsLoading(false)
          setIsLoadingBook(false)

          // Display the book - either from saved location or beginning
          console.log('Displaying book...')
          if (savedProgress && savedProgress.location) {
            console.log('Restoring to saved location:', savedProgress.location)
            try {
              await newRendition.display(savedProgress.location)
              console.log('Successfully restored to saved location')
            } catch (err) {
              console.warn('Failed to restore location, starting from beginning:', err)
              await newRendition.display()
            }
          } else {
            console.log('No saved location, starting from beginning')
            await newRendition.display()
          }
          console.log('Book displayed successfully')

        } catch (err) {
          console.error('Failed to load EPUB:', err)
          setError(`Failed to load EPUB file: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setIsLoading(false)
          setIsLoadingBook(false)
        }
      }

      loadBook()
    }

    loadReadingProgressAndBook()

    // Cleanup function
    return () => {
      console.log('Cleanup function called')
      // Save final reading progress before cleanup
      if (rendition && currentLocation) {
        console.log('Saving final reading progress before cleanup...')
        saveReadingProgressOnLocationChange({ start: { href: currentLocation, percentage: 0 } })
      }
      if (rendition) {
        console.log('Destroying rendition in cleanup...')
        rendition.destroy()
      }
      if (viewerRef.current) {
        console.log('Clearing viewer container in cleanup...')
        viewerRef.current.innerHTML = ''
      }
    }
  }, [fileId, fileUrl])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('Key pressed:', event.key, 'Rendition exists:', !!rendition)
      if (!rendition) return
      
      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          event.preventDefault()
          console.log('Navigating to previous page...')
          rendition.prev()
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault()
          console.log('Navigating to next page...')
          rendition.next()
          break
        case 'Escape':
          event.preventDefault()
          console.log('Closing viewer...')
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [rendition, onClose])

  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize)
    if (rendition) {
      rendition.themes.fontSize(`${newSize}px`)
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    if (rendition) {
      rendition.themes.default({
        body: {
          'font-family': 'Georgia, serif',
          'font-size': `${fontSize}px`,
          'line-height': '1.6',
          'color': newTheme === 'dark' ? '#e0e0e0' : '#333333',
          'background-color': newTheme === 'dark' ? '#1a1a1a' : '#ffffff',
          'padding': '20px',
          'margin': '0',
          'overflow': 'hidden'
        },
        'h1, h2, h3, h4, h5, h6': {
          'color': newTheme === 'dark' ? '#ffffff' : '#000000',
          'margin-top': '1.5em',
          'margin-bottom': '0.5em'
        },
        'p': {
          'margin-bottom': '1em',
          'text-align': 'justify'
        },
        '.epub-container': {
          'overflow': 'hidden'
        },
        '.epub-view': {
          'overflow': 'hidden'
        },
        '.epub-view > div': {
          'margin-top': '0 !important',
          'padding-top': '0 !important'
        },
        '.epub-view iframe': {
          'margin': '0 !important',
          'padding': '0 !important',
          'border': 'none !important'
        },
        '.epub-view iframe body': {
          'margin': '0 !important',
          'padding': '0 !important'
        }
      })
    }
  }

  return (
    <>
      <style>
        {`
          .epub-viewer-container .epub-view {
            margin: 0 !important;
            padding: 0 !important;
          }
          .epub-viewer-container .epub-view > div {
            margin: 0 !important;
            padding: 0 !important;
          }
          .epub-viewer-container .epub-view iframe {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          .epub-viewer-container .epub-view iframe body {
            margin: 0 !important;
            padding: 0 !important;
          }
        `}
      </style>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#9aa0a6' }}>
              Use ← → arrow keys or A/D to navigate • ESC to close
            </span>
            {readingProgress && (
              <span style={{ fontSize: '0.7rem', color: '#4caf50' }}>
                📍 Resuming from saved location
              </span>
            )}
          </div>
          
          {/* Font Size Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>Font:</span>
            <button
              className="btn"
              onClick={() => handleFontSizeChange(Math.max(12, fontSize - 2))}
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
            >
              A-
            </button>
            <span style={{ fontSize: '0.9rem', minWidth: '2rem', textAlign: 'center' }}>
              {fontSize}px
            </span>
            <button
              className="btn"
              onClick={() => handleFontSizeChange(Math.min(24, fontSize + 2))}
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
            >
              A+
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            className="btn"
            onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
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
        background: theme === 'dark' ? '#1a1a1a' : '#ffffff'
      }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
            color: theme === 'dark' ? '#e0e0e0' : '#333333',
            fontSize: '1.1rem'
          }}>
            Loading EPUB file...
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
            color: '#ff4444',
            fontSize: '1.1rem',
            textAlign: 'center',
            padding: '2rem'
          }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
              <div>{error}</div>
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#9aa0a6' }}>
                The EPUB viewer couldn't load this file. You can still download it to read with your preferred EPUB reader.
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <a
                  href={fileUrl}
                  download
                  className="btn"
                  style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                  📥 Download EPUB
                </a>
                <button
                  className="btn"
                  onClick={onClose}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          ref={viewerRef}
          tabIndex={0}
          style={{
            width: '100%',
            height: '100%',
            background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
            overflow: 'auto',
            outline: 'none',
            position: 'relative'
          }}
          className="epub-viewer-container"
          onClick={(e) => {
            console.log('Viewer container clicked, rendition exists:', !!rendition)
            // Don't prevent default to allow EPUB.js to handle clicks
          }}
          onFocus={(e) => {
            console.log('Viewer container focused, rendition exists:', !!rendition)
          }}
        />
      </div>
    </div>
    </>
  )
}
