import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEpubFilesByGroup, uploadEpubFile, downloadEpubFile, deleteEpubFile, type EpubFile } from '../db'

interface EpubManagerProps {
  groupId: string
  groupName: string
}

export default function EpubManager({ groupId, groupName }: EpubManagerProps) {
  const navigate = useNavigate()
  const [epubFiles, setEpubFiles] = useState<EpubFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadEpubFiles()
  }, [groupId])

  const loadEpubFiles = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const files = await fetchEpubFilesByGroup(groupId)
      setEpubFiles(files)
    } catch (err) {
      setError('Failed to load EPUB files')
      console.error('Failed to load EPUB files:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Check if file is EPUB - more robust validation
    const fileName = file.name.toLowerCase().trim()
    const isValidEpub = fileName.endsWith('.epub') || 
                       fileName.endsWith('.epub.zip') ||
                       file.type === 'application/epub+zip' ||
                       file.type === 'application/epub' ||
                       file.type === 'application/zip'
    
    if (!isValidEpub) {
      setError(`Please select an EPUB file. Selected file: ${file.name} (type: ${file.type})`)
      return
    }

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const uploadedFile = await uploadEpubFile(groupId, file)
      // Replace any existing files since only one is allowed per group
      setEpubFiles([uploadedFile])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError('Failed to upload EPUB file')
      console.error('Failed to upload EPUB file:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (file: EpubFile) => {
    try {
      await downloadEpubFile(file.id)
    } catch (err) {
      setError('Failed to download EPUB file')
      console.error('Failed to download EPUB file:', err)
    }
  }



  const handleDelete = async (file: EpubFile) => {
    if (!confirm(`Are you sure you want to delete "${file.originalName}"?`)) {
      return
    }

    try {
      await deleteEpubFile(file.id)
      setEpubFiles(prev => prev.filter(f => f.id !== file.id))
    } catch (err) {
      setError('Failed to delete EPUB file')
      console.error('Failed to delete EPUB file:', err)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div style={{ 
      padding: '1rem', 
      background: '#1a1a1a', 
      borderRadius: 8, 
      border: '1px solid #3a3a3a',
      marginTop: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>EPUB Files for "{groupName}"</h3>
        <button
          className="create-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          {uploading ? '⏳ Uploading...' : '📚 Upload EPUB'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.epub.zip,application/epub+zip,application/epub,application/zip"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {error && (
        <div style={{ 
          padding: '0.5rem', 
          background: '#ff4444', 
          color: 'white', 
          borderRadius: 4, 
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9aa0a6' }}>
          Loading EPUB files...
        </div>
      ) : epubFiles.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem', 
          color: '#9aa0a6',
          background: '#2a2a2a',
          borderRadius: 6,
          border: '1px dashed #3a3a3a'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
          <div>No EPUB files uploaded yet</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Upload an EPUB file to associate it with this word group
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {epubFiles.map(file => (
            <div key={file.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0.75rem',
              background: '#2a2a2a',
              borderRadius: 6,
              border: '1px solid #3a3a3a'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {file.originalName}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9aa0a6' }}>
                  {formatFileSize(file.fileSize)} • Uploaded {formatDate(file.createdAt)}
                </div>
              </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn"
                      onClick={() => handleDownload(file)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    >
                      📥 Download
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleDelete(file)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#ff4444' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ 
        marginTop: '1rem', 
        padding: '0.5rem', 
        background: '#2a2a2a', 
        borderRadius: 4,
        fontSize: '0.8rem',
        color: '#9aa0a6'
      }}>
        <strong>Note:</strong> Only one EPUB file can be associated with each word group. 
        Uploading a new file will replace any existing file.
      </div>
    </div>
  )
}
