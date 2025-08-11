import { useEffect, useState } from 'react'
import './App.css'
import PageHeader from './components/PageHeader'
import EmptyState from './components/EmptyState'
import ListGrid from './components/ListGrid'
import {
  createList as dbCreateList,
  deleteList as dbDeleteList,
  fetchLists as dbFetchLists,
  renameList as dbRenameList,
  type WordList,
} from './db'

function App() {
  const [lists, setLists] = useState<WordList[]>([])

  useEffect(() => {
    let canceled = false
    dbFetchLists().then((fetched) => {
      if (canceled) return
      setLists((prev) => (prev.length === 0 ? fetched : prev))
    })
    return () => {
      canceled = true
    }
  }, [])

  const handleCreateList = async () => {
    const name = window.prompt('Name your list:')?.trim()
    if (!name) return
    const newList = await dbCreateList(name)
    setLists((previousLists) => [newList, ...previousLists])
  }

  const handleRenameList = async (id: string) => {
    const target = lists.find((l) => l.id === id)
    const nextName = window
      .prompt('Rename list:', target?.name ?? '')
      ?.trim()
    if (!nextName) return
    await dbRenameList(id, nextName)
    setLists((previousLists) =>
      previousLists.map((l) => (l.id === id ? { ...l, name: nextName } : l)),
    )
  }

  const handleDeleteList = async (id: string) => {
    const target = lists.find((l) => l.id === id)
    const confirmed = window.confirm(
      `Delete list "${target?.name ?? 'Untitled'}"? This cannot be undone.`,
    )
    if (!confirmed) return
    await dbDeleteList(id)
    setLists((previousLists) => previousLists.filter((l) => l.id !== id))
  }

  return (
    <div className="page">
      <PageHeader title="Wordbook" primaryAction={{ label: 'Create New List +', onClick: handleCreateList }} />

      {lists.length === 0 ? (
        <EmptyState message="No word lists yet." action={{ label: 'Create New List +', onClick: handleCreateList }} />
      ) : (
        <ListGrid
          lists={lists}
          onOpen={(id) => (window.location.href = `/list/${id}`)}
          onRename={handleRenameList}
          onDelete={handleDeleteList}
        />
      )}
    </div>
  )
}

export default App
