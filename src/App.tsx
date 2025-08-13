import { useEffect, useState } from 'react'
import './App.css'
import PageHeader from './components/PageHeader'
import EmptyState from './components/EmptyState'
import WordGroupsGrid from './components/WordGroupsGrid'
import {
  createList as dbCreateList,
  deleteList as dbDeleteList,
  fetchLists as dbFetchLists,
  renameList as dbRenameList,
  moveList as dbMoveList,
  reorderLists as dbReorderLists,
  fetchWordGroups as dbFetchWordGroups,
  createWordGroup as dbCreateWordGroup,
  renameWordGroup as dbRenameWordGroup,
  deleteWordGroup as dbDeleteWordGroup,
  type WordList,
  type WordGroup,
} from './db'

function App() {
  const [lists, setLists] = useState<WordList[]>([])
  const [groups, setGroups] = useState<WordGroup[]>([])

  useEffect(() => {
    let canceled = false
    const loadData = async () => {
      try {
        const [fetchedLists, fetchedGroups] = await Promise.all([dbFetchLists(), dbFetchWordGroups()])
        if (!canceled) {
          setLists(fetchedLists)
          setGroups(fetchedGroups)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
    return () => {
      canceled = true
    }
  }, [])

  // Refresh data function
  const refreshData = async () => {
    try {
      const [fetchedLists, fetchedGroups] = await Promise.all([dbFetchLists(), dbFetchWordGroups()])

      setLists(fetchedLists)
      setGroups(fetchedGroups)
    } catch (error) {
      console.error('Failed to refresh data:', error)
    }
  }

  const handleCreateList = async () => {
    const name = window.prompt('Name your list:')?.trim()
    if (!name) return
    
    // If there are groups, ask which group to add to
    let groupId: string | undefined
    if (groups.length > 0) {
      const groupNames = groups.map(g => g.name)
      const selectedGroup = window.prompt(
        `Select a group (or leave empty for ungrouped):\n${groupNames.join('\n')}`
      )?.trim()
      
      if (selectedGroup) {
        const group = groups.find(g => g.name.toLowerCase() === selectedGroup.toLowerCase())
        if (group) {
          groupId = group.id
        }
      }
    }
    
    await dbCreateList(name, groupId)
    await refreshData()
  }

  const handleCreateGroup = async () => {
    const name = window.prompt('Name your word group:')?.trim()
    if (!name) return
    await dbCreateWordGroup(name)
    // Refresh data to get the updated groups with correct counts
    await refreshData()
  }

  const handleRenameList = async (id: string) => {
    const target = lists.find((l) => l.id === id)
    const nextName = window
      .prompt('Rename list:', target?.name ?? '')
      ?.trim()
    if (!nextName) return
    await dbRenameList(id, nextName)
    await refreshData()
  }

  const handleDeleteList = async (id: string) => {
    const target = lists.find((l) => l.id === id)
    const confirmed = window.confirm(
      `Delete list "${target?.name ?? 'Untitled'}"? This cannot be undone.`,
    )
    if (!confirmed) return
    await dbDeleteList(id)
    await refreshData()
  }

  const handleRenameGroup = async (id: string) => {
    const target = groups.find((g) => g.id === id)
    const nextName = window
      .prompt('Rename group:', target?.name ?? '')
      ?.trim()
    if (!nextName) return
    await dbRenameWordGroup(id, nextName)
    await refreshData()
  }

  const handleDeleteGroup = async (id: string) => {
    const target = groups.find((g) => g.id === id)
    const confirmed = window.confirm(
      `Delete group "${target?.name ?? 'Untitled'}"? Lists in this group will become ungrouped.`,
    )
    if (!confirmed) return
    await dbDeleteWordGroup(id)
    await refreshData()
  }

  const handleMoveList = async (listId: string, groupId: string | null) => {
    await dbMoveList(listId, groupId)
    await refreshData()
  }

  const handleReorderLists = async (listIds: string[], groupId: string | null) => {
    await dbReorderLists(listIds, groupId)
    await refreshData()
  }

  const handleMoveAndReorderList = async (listId: string, groupId: string | null, newOrder: string[]) => {
    // First move the list to the target group
    await dbMoveList(listId, groupId)
    // Then reorder the lists in the target group
    await dbReorderLists(newOrder, groupId)
    await refreshData()
  }

  const handleCreateListInGroup = async (groupId?: string) => {
    const name = window.prompt('Name your list:')?.trim()
    if (!name) return
    
    await dbCreateList(name, groupId)
    await refreshData()
  }

  return (
    <div className="page">
      <PageHeader 
        title="Wordbook" 
        primaryAction={{ label: 'Create New List +', onClick: handleCreateList }}
        showSettings={true}
      />

      {/* Create Group Button */}
      <div style={{ 
        padding: '0 1.25rem', 
        marginBottom: '1rem',
        display: 'flex',
        gap: '0.5rem'
      }}>
        <button 
          className="create-btn" 
          onClick={handleCreateGroup}
          style={{ background: '#2d5a2d', borderColor: '#4caf50' }}
        >
          📁 Create Word Group +
        </button>
      </div>

      {lists.length === 0 && groups.length === 0 ? (
        <EmptyState message="No word groups or lists yet." action={{ label: 'Create New List +', onClick: handleCreateList }} />
      ) : (
        <WordGroupsGrid
          groups={groups}
          lists={lists}
          onOpenList={(id) => (window.location.href = `/list/${id}`)}
          onRenameList={handleRenameList}
          onDeleteList={handleDeleteList}
          onRenameGroup={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
          onMoveList={handleMoveList}
          onReorderLists={handleReorderLists}
          onCreateList={handleCreateListInGroup}
          onMoveAndReorderList={handleMoveAndReorderList}
        />
      )}
    </div>
  )
}

export default App
