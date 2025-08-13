import { type WordList } from '../db'
import ListTile from './ListTile'
import { useDragAndDrop, type DragItem } from '../hooks/useDragAndDrop'

interface DraggableListTileProps {
  list: WordList
  isDragging: boolean
  isClone?: boolean
  isShuffling?: boolean
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onDragStart: (item: DragItem, event: React.DragEvent) => void
  onDragEnd: () => void
}

export default function DraggableListTile({
  list,
  isDragging,
  isClone = false,
  isShuffling = false,
  onOpen,
  onRename,
  onDelete,
  onDragStart,
  onDragEnd
}: DraggableListTileProps) {
  const handleDragStart = (event: React.DragEvent) => {
    const dragItem: DragItem = {
      id: list.id,
      type: 'wordlist',
      data: list
    }
    onDragStart(dragItem, event)
  }

  const handleDragEnd = (event: React.DragEvent) => {
    event.currentTarget.style.cursor = 'grab'
    onDragEnd()
  }

  return (
    <div
      key={list.id}
      draggable={!isClone}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{
        opacity: 1, // Always keep original card at full opacity
        cursor: isClone ? 'default' : 'grab',
        transform: 'none', // No transform on original card
        transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        zIndex: isDragging ? 1000 : 'auto',
        pointerEvents: isClone ? 'none' : 'auto',
        willChange: isDragging ? 'transform' : 'auto'
      }}
      className={`${isDragging ? 'dragging' : ''} ${isShuffling ? 'shuffle-animation' : ''}`}
    >
      <ListTile
        list={list}
        onOpen={onOpen}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  )
}
