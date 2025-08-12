import { type Word } from '../db'

interface WordTableProps {
  words: Word[]
  selectedWords: Set<string>
  selectedWord: Word | null
  onWordSelect: (word: Word) => void
  onWordSelectToggle: (wordId: string) => void
  onSelectAll: () => void
  onEditWord: (word: Word) => void
  onDeleteWord: (word: Word) => void
}

export default function WordTable({
  words,
  selectedWords,
  selectedWord,
  onWordSelect,
  onWordSelectToggle,
  onSelectAll,
  onEditWord,
  onDeleteWord
}: WordTableProps) {
  if (words.length === 0) {
    return (
      <div className="empty">
        <p>No words in this list yet.</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.5rem', width: '50px' }}>
              <input
                type="checkbox"
                checked={selectedWords.size === words.length && words.length > 0}
                onChange={onSelectAll}
                style={{ 
                  margin: 0,
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
            </th>
                              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Word</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Transcription</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Definition</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Strength</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Frequency</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <tr
              key={word.id}
              style={{
                borderTop: '1px solid #2a2a2a',
                cursor: 'pointer',
                background: selectedWord?.id === word.id ? '#1c1c1c' : undefined,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedWord?.id !== word.id) {
                  e.currentTarget.style.backgroundColor = '#1a1a1a'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWord?.id !== word.id) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = '#2a2a2a'
              }}
              onMouseUp={(e) => {
                if (selectedWord?.id !== word.id) {
                  e.currentTarget.style.backgroundColor = '#1a1a1a'
                } else {
                  e.currentTarget.style.backgroundColor = '#1c1c1c'
                }
              }}
              onClick={(e) => {
                // Don't trigger row click if clicking on checkbox or action buttons
                if ((e.target as HTMLElement).tagName === 'INPUT' || 
                    (e.target as HTMLElement).tagName === 'BUTTON' ||
                    (e.target as HTMLElement).closest('button')) {
                  return
                }
                onWordSelect(word)
              }}
            >
              <td style={{ padding: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={selectedWords.has(word.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    onWordSelectToggle(word.id)
                  }}
                  style={{ 
                    margin: 0,
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
              </td>
              <td style={{ padding: '0.5rem' }}>{word.term}</td>
              <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>{word.transcription ?? ''}</td>
              <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>{word.definition ?? ''}</td>
              <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>{word.strength ?? 0}%</td>
              <td style={{ padding: '0.5rem', color: '#9aa0a6' }}>
                <span style={{ 
                  color: word.frequency === 50 ? '#9e9e9e' :
                         word.frequency >= 80 ? '#4caf50' : 
                         word.frequency >= 60 ? '#8bc34a' : 
                         word.frequency >= 40 ? '#ff9800' : 
                         word.frequency >= 20 ? '#f44336' : '#9e9e9e',
                  fontWeight: 'bold'
                }}>
                  {word.frequency === 50 ? 'Unknown' : word.frequency}
                </span>
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button
                  className="btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditWord(word)
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteWord(word)
                  }}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
