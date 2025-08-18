import { useEffect, useRef, useState, useCallback } from 'react'
import Epub, { Rendition } from 'epubjs'
import { getReadingProgress, updateReadingProgress, saveReadingProgress, fetchHighlights, saveHighlight, deleteHighlight, updateHighlightNote } from '../db'
import type { HighlightRecord } from '../db'
import { EpubSidebar } from './epub/EpubSidebar'
import { EpubContent } from './epub/EpubContent'

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
    '.hl': {
      'fill': 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply'
    },
    '.hl *': {
      'fill': 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply'
    },
    '.hl:hover': {
      'fill': 'gold !important', 'fill-opacity': '0.5 !important'
    },
    '.hl-active': {
      'fill': 'goldenrod !important',
      'fill-opacity': '0.6 !important'
    },
    '.hl-active *': {
      'fill': 'goldenrod !important',
      'fill-opacity': '0.6 !important'
    }
  },
  dark: {
    body: {
      'background': '#1a1a1a',
      'color': '#e0e0e0',
      'line-height': '1.6',
    },
    '.hl': {
      'fill': 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply'
    },
    '.hl *': {
      'fill': 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply'
    },
    '.hl:hover': {
      'fill': 'gold !important', 'fill-opacity': '0.5 !important'
    },
    '.hl-active': {
      'fill': 'goldenrod !important',
      'fill-opacity': '0.6 !important'
    },
    '.hl-active *': {
      'fill': 'goldenrod !important',
      'fill-opacity': '0.6 !important'
    }
  },
}

export default function EpubViewer({ fileId, fileUrl, fileName, onClose }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookReady, setIsBookReady] = useState(false)
  const [pageInfo, setPageInfo] = useState<{ currentPage: number, totalPages: number } | null>(null)
  const bookRef = useRef<any>(null)
  const renditionRef = useRef<any>(null)
  const [fontSize, setFontSize] = useState<number>(() => {
    const savedSize = localStorage.getItem('epub-font-size')
    return savedSize ? parseInt(savedSize, 10) : 16
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('epub-theme')
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark'
  })
  const [currentSelection, setCurrentSelection] = useState<{ cfiRange: string; contents: any } | null>(null)
  const [selectedHighlightText, setSelectedHighlightText] = useState<string | null>(null)
  const [activeHighlight, setActiveHighlight] = useState<HighlightRecord | null>(null)
  const activeHighlightRef = useRef<HighlightRecord | null>(null)

  useEffect(() => {
    activeHighlightRef.current = activeHighlight;
  }, [activeHighlight]);

  // This is the core loading and setup effect.
  useEffect(() => {
    let isCancelled = false

    if (!viewerRef.current) {
        return
      }

    // --- State for this effect's lifecycle ---
    let locationsReady = false
    let currentLocationCfi: string | null = null

    // --- Helpers to sync active highlight ---
    const applyActiveStateToDoc = (doc: Document) => {
      try {
        doc.querySelectorAll('.hl-active').forEach((el: Element) => el.classList.remove('hl-active'))
        const current = activeHighlight
        if (current) {
          const matches = doc.querySelectorAll(`[data-epubcfi="${current.cfiRange}"]`)
          matches.forEach(el => el.classList.add('hl-active'))
        }
      } catch {}
    }

    const applyActiveStateAcrossViews = () => {
      try {
        const r: any = renditionRef.current
        const views = r?.getViews ? r.getViews() : (r?.manager?.views || [])
        if (views && Array.isArray(views)) {
          views.forEach((v: any) => {
            const doc = v?.document || v?.iframe?.contentDocument
            if (doc) applyActiveStateToDoc(doc)
          })
        } else if (r?.view?.document) {
          applyActiveStateToDoc(r.view.document)
        }
      } catch {}
    }

    // --- Main Logic ---
    fetch(fileUrl)
      .then(response => {
        return response.arrayBuffer()
      })
      .then(arrayBuffer => {
        if (isCancelled) { return Promise.reject(new Error('Cancelled')) }
        
        const book = new (Epub as any)(arrayBuffer)
        bookRef.current = book

        const rendition = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: '100%',
          allowScriptedContent: true,
        })
        renditionRef.current = rendition
        
        Object.keys(THEMES).forEach(name => {
          rendition.themes.register(name, (THEMES as any)[name])
        })
        rendition.themes.override('line-height', '1.6', true)
        
        rendition.on('rendered', (_section: any, view: any) => {
          const style = view.document.createElement('style')
          style.innerHTML = `
            .hl { fill: yellow; fill-opacity: 0.3; mix-blend-mode: multiply; }
            .hl * { fill: yellow; fill-opacity: 0.3; mix-blend-mode: multiply; }
            .hl:hover { fill: gold !important; fill-opacity: 0.5 !important; }
            .hl-active { 
              fill: goldenrod !important; 
              fill-opacity: 0.6 !important; 
            }
            .hl-active * { 
              fill: goldenrod !important; 
              fill-opacity: 0.6 !important; 
            }
          `
          view.document.head.appendChild(style)
        })

        setRendition(rendition)
        
        // Load highlights from DB
        fetchHighlights(fileId).then((loadedHighlights: HighlightRecord[]) => {
          if (isCancelled) return
          loadedHighlights.forEach((hl: HighlightRecord) => {
            const styles = { fill: 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' } as any
            ;(rendition.annotations as any).highlight(hl.cfiRange, {}, (e: MouseEvent) => {
              handleHighlightClick(hl, e)
            }, 'hl', styles)
          })
        })
        
        return book.ready
      })
      .then(async () => {
        if (isCancelled) { return Promise.reject(new Error('Cancelled')) }
        
        const savedProgress = await getReadingProgress(fileId)
        if (isCancelled) { return Promise.reject(new Error('Cancelled')) }

        // Attach event listeners
        renditionRef.current.on('relocated', (newLocation: any) => {
          if (isCancelled) return
          currentLocationCfi = newLocation.start.cfi
          
          // Re-apply active state on relocation
          applyActiveStateAcrossViews()
          
          if (locationsReady) {
            const currentPage = bookRef.current.locations.locationFromCfi(newLocation.start.cfi)
            const totalPages = bookRef.current.locations.total
            setPageInfo({ currentPage, totalPages })
          }
        })

        renditionRef.current.on('displayed', () => {
          if (isCancelled) return
          setIsBookReady(true)
          
          bookRef.current.locations.generate(1650).then(() => {
            if (isCancelled) return
            locationsReady = true
            setIsLoading(false)
            
            const initialLocation = renditionRef.current.currentLocation()
            currentLocationCfi = initialLocation.start.cfi
            
            const currentPage = bookRef.current.locations.locationFromCfi(initialLocation.start.cfi)
            const totalPages = bookRef.current.locations.total
            setPageInfo({ currentPage, totalPages })

            // Ensure active state applied after initial display
            applyActiveStateAcrossViews()
          })
        })

        renditionRef.current.on('displayError', (err: Error) => {
          if (!isCancelled) setError(err.message)
        });
        
        // Display the book at the saved location, or the beginning
        return renditionRef.current.display(savedProgress?.location)
      })
      .catch((err: Error) => {
        if (!isCancelled && err.message !== 'Cancelled') {
          setError(err.message)
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
      
      // Save final position on unmount if possible
      if (locationsReady && currentLocationCfi && bookRef.current) {
        const cfi = currentLocationCfi
        if (!cfi) return

        const progress = bookRef.current.locations.percentageFromCfi(cfi)
        updateReadingProgress(fileId, cfi, progress).catch((err: Error) => {
          if (err.message.includes('404')) {
            saveReadingProgress(fileId, cfi, progress)
          }
        })
      }

      if (renditionRef.current) {
        renditionRef.current.destroy()
      }
      if (bookRef.current) {
        bookRef.current.destroy()
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
      (rendition.themes as any).select(theme)
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

  const redrawAnnotation = useCallback((hl: HighlightRecord, isActive: boolean) => {
    const renditionAsAny = renditionRef.current as any;
    if (!renditionAsAny) return;

    try {
      renditionAsAny.annotations.remove(hl.cfiRange, 'highlight');
    } catch (e) {
      // It's okay if this fails, it might not be on the current page
    }
    
    const styles = isActive
      ? { fill: 'goldenrod', 'fill-opacity': '0.6', 'mix-blend-mode': 'multiply' }
      : { fill: 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }

    renditionAsAny.annotations.highlight(
      hl.cfiRange,
      {},
      (e: MouseEvent) => handleHighlightClick(hl, e),
      isActive ? 'hl-active' : 'hl',
      styles
    );
  }, []);

  const closeHighlightPanel = () => {
    if (activeHighlightRef.current) {
      redrawAnnotation(activeHighlightRef.current, false);
    }
    setSelectedHighlightText(null)
    setActiveHighlight(null)
  }

  const handleHighlightClick = (hl: HighlightRecord, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentActive = activeHighlightRef.current;
    const isCurrentlyActive = currentActive?.id === hl.id;

    // Deactivate previously active highlight
    if (currentActive && !isCurrentlyActive) {
      redrawAnnotation(currentActive, false);
    }

    if (isCurrentlyActive) {
      // Toggle off
      redrawAnnotation(hl, false);
      setActiveHighlight(null);
      setSelectedHighlightText(null);
    } else {
      // Activate new one
      redrawAnnotation(hl, true);
      setActiveHighlight(hl);
      setSelectedHighlightText(hl.text);
    }
  }

  const addHighlight = useCallback(async (cfiRange: string, contents: any) => {
    if (!rendition) return
    const text = contents.window.getSelection().toString()
    if (!text) return

    contents.window.getSelection().removeAllRanges()
    setCurrentSelection(null)

    try {
      const newHighlight = await saveHighlight(fileId, cfiRange, text, 'yellow')

      // Deactivate previously active highlight
      if (activeHighlightRef.current) {
        redrawAnnotation(activeHighlightRef.current, false);
      }
      
      // Add and activate the new highlight
      redrawAnnotation(newHighlight, true);
      setActiveHighlight(newHighlight)
      setSelectedHighlightText(newHighlight.text)

    } catch (error) {
      console.error('Failed to save highlight:', error)
    }
  }, [rendition, fileId, redrawAnnotation])

  const handleDeleteHighlight = useCallback(async () => {
    if (!activeHighlight || !rendition) return

    try {
      await deleteHighlight(activeHighlight.id)
      ;(rendition as any).annotations.remove(activeHighlight.cfiRange, 'highlight')
      closeHighlightPanel()
    } catch (error) {
      console.error('Failed to delete highlight:', error)
      // Optionally, show an error to the user
    }
  }, [rendition, activeHighlight])

  const handleNoteChange = useCallback(async (note: string) => {
    if (!activeHighlight) return
    console.log(`[DEBUG] handleNoteChange called for highlight ${activeHighlight.id} with note:`, note);

    try {
      await updateHighlightNote(activeHighlight.id, note)
      console.log('[DEBUG] updateHighlightNote successful.');
      setActiveHighlight(current => current ? { ...current, note } : null)
    } catch (error) {
      console.error('[DEBUG] Failed to save note:', error)
      // Optionally show an error to the user
    }
  }, [activeHighlight])

  useEffect(() => {
    if (!rendition) return
    
    const handleSelection = (cfiRange: string, contents: any) => {
      const selection = contents.window.getSelection()
      
      // Check if this is a real drag-selection and not just a click
      if (selection && !selection.isCollapsed && selection.toString().length > 0) {
        // If a highlight is active, close it to make way for the new selection prompt
        if (activeHighlight) {
          closeHighlightPanel()
        }
        setCurrentSelection({ cfiRange, contents })
      } else {
        // This was just a click, not a drag-selection. 
        // If the "Press Shift+H" prompt is visible, hide it.
        if (currentSelection) {
          setCurrentSelection(null)
        }
      }
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'H' && currentSelection) {
        addHighlight(currentSelection.cfiRange, currentSelection.contents)
      }
    }
    
    ;(rendition as any).on('selected', handleSelection)
    ;(rendition as any).on('keyup', handleKeyPress)

    return () => {
      ;(rendition as any).off('selected', handleSelection)
      ;(rendition as any).off('keyup', handleKeyPress)
    }
  }, [rendition, addHighlight, currentSelection, activeHighlight])

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        zIndex: 2000,
      }}>
        <EpubSidebar
          fileName={fileName}
          isBookReady={isBookReady}
          fontSize={fontSize}
          theme={theme}
          currentSelection={currentSelection}
          selectedHighlightText={selectedHighlightText}
          activeHighlight={activeHighlight}
          pageInfo={pageInfo}
          isLoading={isLoading}
          onClose={onClose}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          onFontSizeChange={setFontSize}
          onThemeChange={setTheme}
          onCloseHighlightPanel={closeHighlightPanel}
          onDeleteHighlight={handleDeleteHighlight}
          onNoteChange={handleNoteChange}
        />
        <EpubContent ref={viewerRef} theme={theme} error={error} />
      </div>
    )
  }
