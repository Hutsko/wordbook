import { useState, useRef, useCallback, useEffect } from 'react'

export interface DragItem {
  id: string
  type: 'wordlist'
  data: any
}

export interface DropZone {
  id: string
  type: 'group' | 'ungrouped'
  accepts: string[]
}

export interface DragState {
  isDragging: boolean
  draggedItem: DragItem | null
  dragOverZone: string | null
  dropIndex: number | null
  mousePosition: { x: number; y: number }
}

export function useDragAndDrop() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItem: null,
    dragOverZone: null,
    dropIndex: null,
    mousePosition: { x: 0, y: 0 }
  })

  const dragRef = useRef<HTMLDivElement | null>(null)
  
  // Create a transparent 1x1 pixel image for drag image
  const transparentImage = useRef<HTMLImageElement | null>(null)
  
  useEffect(() => {
    // Create and pre-load the transparent image
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
    transparentImage.current = img
  }, [])

  const startDrag = useCallback((item: DragItem, event: React.DragEvent) => {
    console.log('Starting drag for item:', item.id)
    
    setDragState({
      isDragging: true,
      draggedItem: item,
      dragOverZone: null,
      dropIndex: null,
      mousePosition: { x: event.clientX, y: event.clientY }
    })
    
    // Use the pre-loaded transparent image to hide the browser's drag image
    if (transparentImage.current) {
      event.dataTransfer.setDragImage(transparentImage.current, 0, 0)
    }
    
    // Set cursor
    event.dataTransfer.effectAllowed = 'move'
    ;(event.currentTarget as HTMLElement).style.cursor = 'grabbing'
  }, [])

  const endDrag = useCallback(() => {
    // Reset drag state immediately
    setDragState({
      isDragging: false,
      draggedItem: null,
      dragOverZone: null,
      dropIndex: null,
      mousePosition: { x: 0, y: 0 }
    })
  }, [])

  const handleDragOver = useCallback((zoneId: string, index: number, event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    console.log('Drag over zone:', zoneId, 'index:', index)
    
    setDragState(prev => ({
      ...prev,
      dragOverZone: zoneId,
      dropIndex: index,
      mousePosition: { x: event.clientX, y: event.clientY }
    }))
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      dragOverZone: null,
      dropIndex: null
    }))
  }, [])

  const handleGlobalDragOver = useCallback((event: React.DragEvent) => {
    if (dragState.isDragging) {
      setDragState(prev => ({
        ...prev,
        mousePosition: { x: event.clientX, y: event.clientY }
      }))
    }
  }, [dragState.isDragging])

  return {
    dragState,
    dragRef,
    startDrag,
    endDrag,
    handleDragOver,
    handleDragLeave,
    handleGlobalDragOver
  }
}
