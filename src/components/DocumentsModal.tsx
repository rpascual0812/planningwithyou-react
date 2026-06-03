import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type DocumentRecord,
  type FolderRecord,
  fetchDocuments,
  fetchFolders,
  uploadDocument,
  deleteDocument,
} from '../services/documents'

export type DocumentsModalProps = {
  onSelect: (doc: DocumentRecord) => void
  onClose: () => void
}

const FILE_ICON_MAP: Record<string, string> = {
  pdf: 'bi-file-earmark-pdf text-danger',
  doc: 'bi-file-earmark-word text-primary',
  docx: 'bi-file-earmark-word text-primary',
  xls: 'bi-file-earmark-excel text-success',
  xlsx: 'bi-file-earmark-excel text-success',
  csv: 'bi-file-earmark-spreadsheet text-success',
  ppt: 'bi-file-earmark-ppt text-warning',
  pptx: 'bi-file-earmark-ppt text-warning',
  zip: 'bi-file-earmark-zip text-secondary',
  rar: 'bi-file-earmark-zip text-secondary',
  txt: 'bi-file-earmark-text text-muted',
  mp4: 'bi-file-earmark-play text-info',
  mp3: 'bi-file-earmark-music text-info',
}

function fileIcon(ext: string): string {
  return FILE_ICON_MAP[ext] || 'bi-file-earmark text-secondary'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DocumentsModal = ({ onSelect, onClose }: DocumentsModalProps) => {
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const folderIdRef = useRef<number | null>(null)
  folderIdRef.current = selectedFolderId

  const load = useCallback(async (q = '') => {
    setLoading(true)
    setError(null)
    try {
      const opts: { search?: string; folder?: number } = {}
      if (q) opts.search = q
      if (folderIdRef.current) opts.folder = folderIdRef.current
      const data = await fetchDocuments(opts)
      setDocs(data)
    } catch {
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFolders().then(setFolders).catch(() => {})
    load()
  }, [load])

  useEffect(() => {
    load(search)
  }, [selectedFolderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [onClose])

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(searchTimer.current ?? undefined)
    searchTimer.current = setTimeout(() => load(val), 300)
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, selectedFolderId ?? undefined)
      }
      await load(search)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteDocument(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch {
      setError('Failed to delete document')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  return (
    <>
      <div
        className="docs-modal-backdrop modal-backdrop fade show"
        onClick={onClose}
      />
      <div
        className="docs-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="documentsModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="documentsModalTitle" className="modal-title fs-5">
                <i className="bi bi-folder2-open me-2" />
                Documents
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <div className="d-flex gap-2 mb-3">
                <select
                  className="form-select"
                  style={{ maxWidth: '180px' }}
                  value={selectedFolderId ?? ''}
                  onChange={(e) =>
                    setSelectedFolderId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">All Folders</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="d-none"
                  multiple
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <button
                  type="button"
                  className="btn btn-primary text-nowrap"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <i className="bi bi-upload me-1" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>

              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}

              <div
                className={`docs-grid-area ${dragOver ? 'docs-drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {loading ? (
                  <div className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" />
                    Loading...
                  </div>
                ) : docs.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-cloud-upload fs-1 d-block mb-2" />
                    {search ? 'No files match your search' : 'No files yet. Drop files here or click Upload.'}
                  </div>
                ) : (
                  <div className="docs-thumbnail-grid">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="docs-thumb-card"
                        onClick={() => onSelect(doc)}
                        title={doc.original_name}
                      >
                        <button
                          type="button"
                          className="docs-thumb-delete"
                          onClick={(e) => handleDelete(doc.id, e)}
                          title="Delete"
                        >
                          <i className="bi bi-x" />
                        </button>
                        <div className="docs-thumb-preview">
                          {doc.is_image ? (
                            <img src={doc.url} alt={doc.original_name} />
                          ) : (
                            <i className={`bi ${fileIcon(doc.extension)} docs-thumb-icon`} />
                          )}
                        </div>
                        <div className="docs-thumb-name" title={doc.original_name}>
                          {doc.original_name}
                        </div>
                        <div className="docs-thumb-size">
                          {formatSize(doc.size)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default DocumentsModal
