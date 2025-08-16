import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchEpubFileById, type EpubFile } from '../db'
import EpubViewer from '../components/EpubViewer'

export default function ReaderPage() {
  const { fileId } = useParams<{ fileId: string }>()
  const navigate = useNavigate()
  const [epubFile, setEpubFile] = useState<EpubFile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fileId) {
      setError('No file ID provided')
      setIsLoading(false)
      return
    }

    const loadEpubFile = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const file = await fetchEpubFileById(fileId)
        setEpubFile(file)
      } catch (err) {
        setError('Failed to load EPUB file')
        console.error('Failed to load EPUB file:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadEpubFile()
  }, [fileId])

  const handleBack = () => {
    navigate('/')
  }

  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e0e0e0',
        fontSize: '1.1rem'
      }}>
        Loading EPUB file...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ff4444',
        fontSize: '1.1rem',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
          <div>{error}</div>
          <button
            className="btn"
            onClick={handleBack}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!epubFile) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9aa0a6',
        fontSize: '1.1rem',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <div>EPUB file not found</div>
          <button
            className="btn"
            onClick={handleBack}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <EpubViewer
      fileId={epubFile.id}
      fileUrl={`${import.meta.env.VITE_API_BASE || 'http://localhost:3001/api'}/epub-files/${epubFile.id}/view`}
      fileName={epubFile.originalName}
      onClose={handleBack}
    />
  )


}
