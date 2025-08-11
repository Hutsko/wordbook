// no React import needed with modern JSX runtime
import type { WordList } from '../db'

type ListTileProps = {
  list: WordList
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

export default function ListTile({ list, onOpen, onRename, onDelete }: ListTileProps) {
  return (
    <article
      className="tile"
      onClick={() => onOpen(list.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(list.id)
      }}
    >
      <h2 className="tile-title">{list.name}</h2>
      <p className="tile-meta">{list.wordsCount} words</p>
      <div className="tile-actions">
        <button className="btn" onClick={(e) => { e.stopPropagation(); onRename(list.id) }}>Rename</button>
        <button className="btn danger" onClick={(e) => { e.stopPropagation(); onDelete(list.id) }}>Delete</button>
      </div>
    </article>
  )
}


