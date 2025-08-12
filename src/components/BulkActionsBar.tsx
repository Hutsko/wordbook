interface BulkActionsBarProps {
  selectedCount: number
  onBulkDelete: () => void
  onBulkMove: () => void
}

export default function BulkActionsBar({ 
  selectedCount, 
  onBulkDelete, 
  onBulkMove 
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div style={{ 
      display: 'flex', 
      gap: '0.5rem', 
      marginBottom: '1rem', 
      padding: '0.75rem', 
      background: '#1a1a1a', 
      borderRadius: 8, 
      border: '1px solid #3a3a3a' 
    }}>
      <span style={{ color: '#9aa0a6', display: 'flex', alignItems: 'center' }}>
        {selectedCount} word{selectedCount > 1 ? 's' : ''} selected
      </span>
      <button 
        className="btn danger" 
        onClick={onBulkDelete}
        style={{ marginLeft: 'auto' }}
      >
        Delete Selected
      </button>
      <button 
        className="btn" 
        onClick={onBulkMove}
      >
        Move to List
      </button>
    </div>
  )
}
