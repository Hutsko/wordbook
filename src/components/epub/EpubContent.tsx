import { forwardRef } from 'react'

interface EpubContentProps {
  theme: 'light' | 'dark'
  error: string | null
}

export const EpubContent = forwardRef<HTMLDivElement, EpubContentProps>(({ theme, error }, ref) => {
  return (
    <div style={{
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      background: theme === 'dark' ? '#1a1a1a' : '#fff'
    }}>
      <div ref={ref} style={{ height: '100%' }} />

      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: theme === 'dark' ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ff4444',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div>
            <div style={{ marginBottom: '1rem' }}>Error loading book:</div>
            <div>{error}</div>
          </div>
        </div>
      )}
    </div>
  )
})

EpubContent.displayName = 'EpubContent'
