import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { type WordGroup, type WordList, fetchEpubFilesByGroup } from '../db'
import DraggableListTile from './DraggableListTile'
import DragPreview from './DragPreview'
import EpubManagerModal from './EpubManagerModal'
import { useDragAndDrop, type DragItem } from '../hooks/useDragAndDrop'

interface WordGroupsGridProps {
  groups: WordGroup[]
  lists: WordList[]
  onOpenList: (id: string) => void
  onRenameList: (id: string) => void
  onDeleteList: (id: string) => void
  onRenameGroup: (id: string) => void
  onDeleteGroup: (id: string) => void
  onMoveList: (listId: string, groupId: string | null) => void
  onReorderLists: (listIds: string[], groupId: string | null) => void
  onCreateList: (groupId?: string) => void
  onMoveAndReorderList: (listId: string, groupId: string | null, newOrder: string[]) => void
}

export default function WordGroupsGrid({
  groups,
  lists,
  onOpenList,
  onRenameList,
  onDeleteList,
  onRenameGroup,
  onDeleteGroup,
  onMoveList,
  onReorderLists,
  onCreateList,
  onMoveAndReorderList
}: WordGroupsGridProps) {
  const navigate = useNavigate()
  const [dropIndicator, setDropIndicator] = useState<{ zoneId: string; index: number; x: number } | null>(null)
  const [epubManagerOpen, setEpubManagerOpen] = useState<{ groupId: string; groupName: string } | null>(null)
  
  const {
    dragState,
    dragRef,
    startDrag,
    endDrag,
    handleDragOver,
    handleDragLeave,
    handleGlobalDragOver
  } = useDragAndDrop()

  // Group lists by groupId, maintaining the order from the backend (created_at DESC)
  const listsByGroup = lists.reduce((acc, list) => {
    const groupId = list.groupId || 'ungrouped'
    if (!acc[groupId]) {
      acc[groupId] = []
    }
    acc[groupId].push(list)
    return acc
  }, {} as Record<string, WordList[]>)

  // Create ungrouped group for lists without a group
  const ungroupedLists = listsByGroup['ungrouped'] || []
  const hasUngrouped = ungroupedLists.length > 0



  const handleViewEpub = async (groupId: string) => {
    try {
      const epubFiles = await fetchEpubFilesByGroup(groupId)
      if (epubFiles.length > 0) {
        // Navigate to the first EPUB file
        navigate(`/reader/${epubFiles[0].id}`)
      } else {
        // No EPUB files found, show a more helpful message
        const confirmed = window.confirm(
          'No EPUB files found for this group. Would you like to upload an EPUB file now?'
        )
        if (confirmed) {
          setEpubManagerOpen({ groupId, groupName: groups.find(g => g.id === groupId)?.name || 'Unknown Group' })
        }
      }
    } catch (error) {
      console.error('Failed to fetch EPUB files:', error)
      alert('Failed to load EPUB files. Please try again.')
    }
  }

  const handleDrop = (zoneId: string, index: number, event: React.DragEvent) => {
    console.log('Drop event triggered:', { zoneId, index, draggedItem: dragState.draggedItem })
    
    if (!dragState.draggedItem || dragState.draggedItem.type !== 'wordlist') {
      console.log('Invalid drop - no dragged item or wrong type')
      return
    }
    
    const listId = dragState.draggedItem.id
    const draggedList = lists.find(l => l.id === listId)
    const targetGroupId = zoneId === 'ungrouped' ? null : zoneId
    
    // Check if we're reordering within the same group
    if (draggedList && draggedList.groupId === targetGroupId) {
      console.log('Reordering within same group:', targetGroupId)
      
      // Get all lists in the target group, sorted by orderIndex ASC (lowest first)
      const groupLists = (zoneId === 'ungrouped' 
        ? lists.filter(l => l.groupId === null)
        : lists.filter(l => l.groupId === zoneId)
      ).sort((a, b) => a.orderIndex - b.orderIndex)
      
      // Find the current position of the dragged item
      const currentIndex = groupLists.findIndex(l => l.id === listId)
      
      // Check if dropping in the adjacent drop zone (no-op case)
      // If dropping in the drop zone immediately after the current position, do nothing
      if (index === currentIndex + 1) {
        console.log('Dropping in adjacent drop zone - no reordering needed')
        endDrag()
        setDropIndicator(null)
        return
      }
      
      // Remove the dragged item from its current position
      const listsWithoutDragged = groupLists.filter(l => l.id !== listId)
      
      // The drop zone index represents the insertion position:
      // - index 0: insert at the beginning (first position)
      // - index 1: insert after the first card (second position)
      // - index 2: insert after the second card (third position), etc.
      const newOrder = []
      
      for (let i = 0; i < listsWithoutDragged.length; i++) {
        if (i === index) {
          newOrder.push(listId) // Insert the dragged item at this position
        }
        newOrder.push(listsWithoutDragged[i].id)
      }
      
      // If index is at the end, add the dragged item there
      if (index === groupLists.length) {
        newOrder.push(listId)
      }
      
      console.log('New order:', newOrder)
      onReorderLists(newOrder, targetGroupId)
    } else {
      // Moving to a different group (including empty groups)
      console.log('Moving to different group:', targetGroupId)
      
      // Get the target group lists (excluding the dragged item)
      const targetGroupLists = (zoneId === 'ungrouped' 
        ? lists.filter(l => l.groupId === null && l.id !== listId)
        : lists.filter(l => l.groupId === zoneId && l.id !== listId)
      ).sort((a, b) => a.orderIndex - b.orderIndex)
      
      // Create the new order for the target group
      const newOrder = []
      
      for (let i = 0; i < targetGroupLists.length; i++) {
        if (i === index) {
          newOrder.push(listId) // Insert the dragged item at this position
        }
        newOrder.push(targetGroupLists[i].id)
      }
      
      // If index is at the end, add the dragged item there
      if (index === targetGroupLists.length) {
        newOrder.push(listId)
      }
      
      console.log('Moving to different group with new order:', newOrder)
      
      // Move the list to the target group and reorder in one operation
      onMoveAndReorderList(listId, targetGroupId, newOrder)
    }
    
    // Delay endDrag to ensure DOM has time to update
    setTimeout(() => {
      endDrag()
      setDropIndicator(null)
    }, 50)
  }

  const handleContinuousDragOver = (zoneId: string, event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    // Only show drop indicator if we're actually dragging a wordlist
    if (!dragState.isDragging || dragState.draggedItem?.type !== 'wordlist') {
      return
    }
    
    const container = event.currentTarget as HTMLElement
    const rect = container.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    
    // Get all cards in this group
    const groupLists = zoneId === 'ungrouped' 
      ? ungroupedLists.sort((a, b) => a.orderIndex - b.orderIndex)
      : listsByGroup[zoneId]?.sort((a, b) => a.orderIndex - b.orderIndex) || []
    
    // Calculate card positions
    const cardWidth = 280 // Width of each card
    const cardGap = 8 // Gap between cards (0.5rem = 8px)
    const totalCardWidth = cardWidth + cardGap
    const leftPadding = 8 // Reduced left padding for drop zone indicator space
    
    // Find the closest drop position
    let closestIndex = 0
    let closestX = 0 // Position before first card (at the very beginning)
    
    // If group is empty, always drop at position 0 (beginning)
    if (groupLists.length === 0) {
      closestIndex = 0
      closestX = leftPadding / 2 // Center in the padding space
    } else {
      // Check position before first card
      const distanceToStart = Math.abs(mouseX - (leftPadding / 2))
      let minDistance = distanceToStart
      
      // Check positions between cards and after the last card
      for (let i = 0; i <= groupLists.length; i++) {
        let cardCenterX: number
        
        if (i === 0) {
          // Position before first card - center in the padding space
          cardCenterX = leftPadding / 2
        } else if (i === groupLists.length) {
          // Position after last card - center of the gap after the last card
          cardCenterX = leftPadding + (groupLists.length * cardWidth) + ((groupLists.length - 1) * cardGap) + (cardGap / 2)
        } else {
          // Position between cards - center of the gap between cards
          cardCenterX = leftPadding + (i * cardWidth) + ((i - 1) * cardGap) + (cardGap / 2)
        }
        
        const distance = Math.abs(mouseX - cardCenterX)
        
        if (distance < minDistance) {
          minDistance = distance
          closestIndex = i
          closestX = cardCenterX
        }
      }
    }
    
    setDropIndicator({ zoneId, index: closestIndex, x: closestX })
    
    console.log('Continuous drag over:', { zoneId, closestIndex, closestX })
  }

  const handleContinuousDragLeave = () => {
    setDropIndicator(null)
  }

  // Also clear drop indicator when drag ends
  const handleDragEnd = () => {
    // Delay endDrag to ensure DOM has time to update
    setTimeout(() => {
      endDrag()
      setDropIndicator(null)
    }, 50)
  }

  const handleContinuousDrop = (zoneId: string, event: React.DragEvent) => {
    console.log('Continuous drop triggered:', { zoneId, dropIndicator })
    
    if (dropIndicator && dropIndicator.zoneId === zoneId) {
      handleDrop(zoneId, dropIndicator.index, event)
    } else if (dragState.draggedItem && dragState.draggedItem.type === 'wordlist') {
      // Fallback: if no drop indicator, drop at the end of the group
      const groupLists = zoneId === 'ungrouped' 
        ? ungroupedLists.sort((a, b) => a.orderIndex - b.orderIndex)
        : listsByGroup[zoneId]?.sort((a, b) => a.orderIndex - b.orderIndex) || []
      
      handleDrop(zoneId, groupLists.length, event)
    }
  }

  const isDragging = dragState.isDragging
  const draggedListId = dragState.draggedItem?.id

  return (
    <div onDragOver={handleGlobalDragOver} className={dragState.isDragging ? 'dragging-active' : ''}>
      {/* Word Groups */}
      {groups.map((group) => {
        const groupLists = listsByGroup[group.id] || []
        
        return (
          <section key={group.id} style={{ marginBottom: '2rem', padding: '0 1.25rem' }}>
            {/* Group Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '1rem',
              padding: '0.5rem 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  color: '#ffffff'
                }}>
                  {group.name}
                </h2>
                <span style={{ 
                  color: '#9aa0a6', 
                  fontSize: '0.9rem',
                  background: '#2a2a2a',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px',
                  marginLeft: '0.5rem'
                }}>
                  {groupLists.length} list{groupLists.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn"
                  onClick={() => setEpubManagerOpen({ groupId: group.id, groupName: group.name })}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                >
                  📚 Manage EPUB
                </button>
                <button 
                  className="btn"
                  onClick={() => handleViewEpub(group.id)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', background: '#4caf50' }}
                >
                  📖 Read
                </button>
                <button 
                  className="create-btn"
                  onClick={() => onCreateList(group.id)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                >
                  + Create List
                </button>
                <button 
                  className="btn"
                  onClick={() => onRenameGroup(group.id)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                >
                  Rename
                </button>
                <button 
                  className="btn danger"
                  onClick={() => onDeleteGroup(group.id)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Horizontal Scrolling Lists */}
            <div 
              className={`horizontal-scroll ${dragState.isDragging ? 'dragging-active' : ''}`}
              onDragOver={(e) => handleContinuousDragOver(group.id, e)}
              onDragLeave={handleContinuousDragLeave}
              onDrop={(e) => handleContinuousDrop(group.id, e)}
              style={{ 
                position: 'relative',
                minHeight: groupLists.length === 0 ? '180px' : 'auto',
                alignItems: groupLists.length === 0 ? 'center' : 'flex-start',
                paddingLeft: '8px' // Reduced padding - just enough for the thin indicator
              }}
            >
              {groupLists.length === 0 && (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9aa0a6',
                  fontSize: '0.9rem',
                  fontStyle: 'italic',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}>
                  Drop cards here
                </div>
              )}
              
              {groupLists.map((list, index) => (
                <DraggableListTile
                  key={list.id}
                  list={list}
                  isDragging={isDragging && draggedListId === list.id}
                  isClone={false}
                  isShuffling={false}
                  onOpen={onOpenList}
                  onRename={onRenameList}
                  onDelete={onDeleteList}
                  onDragStart={startDrag}
                  onDragEnd={handleDragEnd}
                />
              ))}
              
              {/* Drop Indicator */}
              {dropIndicator && dropIndicator.zoneId === group.id &&
               // Don't show drop indicator if it would be positioned adjacent to the dragged element
               !(dragState.draggedItem && 
                 dragState.draggedItem.type === 'wordlist' && 
                 (() => {
                   const draggedIndex = groupLists.findIndex(list => list.id === dragState.draggedItem?.id)
                   // Hide if drop indicator would be at the same position or adjacent to dragged element
                   return draggedIndex !== -1 && (
                     dropIndicator.index === draggedIndex || 
                     dropIndicator.index === draggedIndex + 1
                   )
                 })()) && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: Math.max(4, dropIndicator.x), // Ensure at least 4px from left edge to prevent cropping
                    transform: 'translate(-50%, -50%)',
                    width: '4px',
                    height: '160px',
                    background: '#646cff',
                    borderRadius: '2px',
                    boxShadow: '0 0 12px rgba(100, 108, 255, 0.8)',
                    zIndex: 1001,
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>
          </section>
        )
      })}

      {/* EPUB Manager Modal */}
      {epubManagerOpen && (
        <EpubManagerModal
          isOpen={true}
          groupId={epubManagerOpen.groupId}
          groupName={epubManagerOpen.groupName}
          onClose={() => setEpubManagerOpen(null)}
        />
      )}

      {/* Ungrouped Lists */}
      {hasUngrouped && (
        <section style={{ marginBottom: '2rem', padding: '0 1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '1rem',
            padding: '0.5rem 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontWeight: '600',
                color: '#ffffff'
              }}>
                Ungrouped Lists
              </h2>
              <span style={{ 
                color: '#9aa0a6', 
                fontSize: '0.9rem',
                background: '#2a2a2a',
                padding: '0.25rem 0.5rem',
                borderRadius: '12px',
                marginLeft: '0.5rem'
              }}>
                {ungroupedLists.length} list{ungroupedLists.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="create-btn"
                onClick={() => onCreateList()}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
              >
                + Create List
              </button>
            </div>
          </div>

          <div 
            className={`horizontal-scroll ${dragState.isDragging ? 'dragging-active' : ''}`}
            onDragOver={(e) => handleContinuousDragOver('ungrouped', e)}
            onDragLeave={handleContinuousDragLeave}
            onDrop={(e) => handleContinuousDrop('ungrouped', e)}
            style={{ 
              position: 'relative',
              minHeight: ungroupedLists.length === 0 ? '180px' : 'auto',
              alignItems: ungroupedLists.length === 0 ? 'center' : 'flex-start',
              paddingLeft: '8px' // Reduced padding - just enough for the thin indicator
            }}
          >
            {ungroupedLists.length === 0 && (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9aa0a6',
                fontSize: '0.9rem',
                fontStyle: 'italic',
                pointerEvents: 'none',
                userSelect: 'none'
              }}>
                Drop cards here
              </div>
            )}
            
            {(ungroupedLists.sort((a, b) => a.orderIndex - b.orderIndex)).map((list, index) => (
                             <DraggableListTile
                 key={list.id}
                 list={list}
                 isDragging={isDragging && draggedListId === list.id}
                 isClone={false}
                 isShuffling={false}
                 onOpen={onOpenList}
                 onRename={onRenameList}
                 onDelete={onDeleteList}
                 onDragStart={startDrag}
                 onDragEnd={handleDragEnd}
               />
            ))}
            
            {/* Drop Indicator */}
            {dropIndicator && dropIndicator.zoneId === 'ungrouped' &&
             // Don't show drop indicator if it would be positioned adjacent to the dragged element
             !(dragState.draggedItem && 
               dragState.draggedItem.type === 'wordlist' && 
               (() => {
                 const draggedIndex = ungroupedLists.findIndex(list => list.id === dragState.draggedItem?.id)
                 // Hide if drop indicator would be at the same position or adjacent to dragged element
                 return draggedIndex !== -1 && (
                   dropIndicator.index === draggedIndex || 
                   dropIndicator.index === draggedIndex + 1
                 )
               })()) && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: Math.max(4, dropIndicator.x), // Ensure at least 4px from left edge to prevent cropping
                  transform: 'translate(-50%, -50%)',
                  width: '4px',
                  height: '160px',
                  background: '#646cff',
                  borderRadius: '2px',
                  boxShadow: '0 0 12px rgba(100, 108, 255, 0.8)',
                  zIndex: 1001,
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </section>
      )}

      {/* Empty State */}
      {groups.length === 0 && lists.length === 0 && (
        <div className="empty">
          <p>No word groups or lists yet.</p>
        </div>
      )}

      {/* Drag Preview */}
      {dragState.isDragging && dragState.draggedItem && dragState.draggedItem.type === 'wordlist' && (
        <DragPreview
          list={dragState.draggedItem.data}
          isVisible={true}
          position={dragState.mousePosition}
        />
      )}

    </div>
  )
}
