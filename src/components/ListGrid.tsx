// no React import needed with modern JSX runtime
import type { WordList } from '../db'
import ListTile from './ListTile'

type ListGridProps = {
  lists: WordList[]
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

export default function ListGrid({ lists, onOpen, onRename, onDelete }: ListGridProps) {
  return (
    <section className="grid" aria-label="Word lists">
      {lists.map((list) => (
        <ListTile key={list.id} list={list} onOpen={onOpen} onRename={onRename} onDelete={onDelete} />
      ))}
    </section>
  )
}


