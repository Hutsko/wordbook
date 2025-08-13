import { type DragState } from '../hooks/useDragAndDrop'

interface DropZoneProps {
  zoneId: string
  index: number
  isActive: boolean
  onDragOver: (zoneId: string, index: number, event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (zoneId: string, index: number, event: React.DragEvent) => void
  children: React.ReactNode
}

export default function DropZone({
  zoneId,
  index,
  isActive,
  onDragOver,
  onDragLeave,
  onDrop,
  children
}: DropZoneProps) {
  const handleDragOver = (event: React.DragEvent) => {
    onDragOver(zoneId, index, event)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    onDrop(zoneId, index, event)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        minHeight: '180px',
        width: '60px', // Much smaller width - just enough to be functional
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isActive 
          ? '2px dashed #646cff' 
          : '2px dashed rgba(100, 108, 255, 0.15)', // More subtle when not active
        borderRadius: '8px', // Smaller border radius to match smaller size
        transition: 'all 0.2s ease',
        backgroundColor: isActive 
          ? 'rgba(100, 108, 255, 0.1)' 
          : 'rgba(100, 108, 255, 0.01)', // Very subtle background
        flexShrink: 0,
        margin: '0 0.125rem', // Keep the same margin for spacing
        opacity: isActive ? 1 : 0.4 // More subtle when not active
      }}
    >
      {/* Drop indicator */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '4px', // Thinner indicator
            height: '160px',
            background: '#646cff',
            borderRadius: '2px',
            boxShadow: '0 0 12px rgba(100, 108, 255, 0.8)',
            zIndex: 1001,
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        />
      )}
      {children}
    </div>
  )
}
