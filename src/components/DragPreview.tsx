import { type WordList } from '../db'
import ListTile from './ListTile'

interface DragPreviewProps {
  list: WordList
  isVisible: boolean
  position: { x: number; y: number }
}

export default function DragPreview({ list, isVisible, position }: DragPreviewProps) {
  if (!isVisible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
        pointerEvents: 'none',
        opacity: 0.1, // Very low opacity as requested
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
      }}
    >
      <ListTile
        list={list}
        onOpen={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />
    </div>
  )
}
