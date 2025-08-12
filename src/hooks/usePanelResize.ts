import { useState, useEffect } from 'react'

interface UsePanelResizeOptions {
  initialWidth: number
  minWidth: number
  maxWidth: number
}

export function usePanelResize({ initialWidth, minWidth, maxWidth }: UsePanelResizeOptions) {
  const [panelWidth, setPanelWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isResizing) return
      const proposed = e.clientX
      const clamped = Math.max(minWidth, Math.min(maxWidth, proposed))
      setPanelWidth(clamped)
    }

    function onUp() {
      setIsResizing(false)
      // Restore text selection
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
      document.body.style.mozUserSelect = ''
      document.body.style.msUserSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    if (isResizing) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }
  }, [isResizing, minWidth, maxWidth])

  const startResize = () => {
    setIsResizing(true)
    // Prevent text selection during resize
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    document.body.style.mozUserSelect = 'none'
    document.body.style.msUserSelect = 'none'
  }

  return {
    panelWidth,
    isResizing,
    startResize
  }
}
