import { useCallback, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'

import DocumentsModal from './DocumentsModal'
import ListShowMoreFooter from './ListShowMoreFooter'
import { useVisibleListSlice } from '../hooks/useVisibleListSlice'
import { downloadSecuredFile } from '../lib/securedFileUrl'
import type { DocumentRecord } from '../services/documents'
import {
  attachQuotationDocumentFromFileManager,
  deleteQuotationDocument,
  fetchQuotationDocuments,
  uploadQuotationDocument,
} from '../services/quotationDocuments'
import { showErrorToast, showSuccessToast } from '../utils/toast'

type Props = {
  quotationId: number
  readOnly?: boolean
  onHistoryChange?: () => void
}

const FILE_ICON: Record<string, string> = {
  pdf: 'bi-file-earmark-pdf-fill text-danger',
  doc: 'bi-file-earmark-word-fill text-primary',
  docx: 'bi-file-earmark-word-fill text-primary',
  xls: 'bi-file-earmark-excel-fill text-success',
  xlsx: 'bi-file-earmark-excel-fill text-success',
  zip: 'bi-file-earmark-zip-fill text-info',
  rar: 'bi-file-earmark-zip-fill text-info',
}

function fileIcon(ext: string, isImage: boolean): string {
  if (isImage) return 'bi-file-earmark-image-fill text-success'
  return FILE_ICON[ext] ?? 'bi-file-earmark-fill text-secondary'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const QuotationDocumentsPanel = ({
  quotationId,
  readOnly = false,
  onHistoryChange,
}: Props) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchQuotationDocuments(quotationId)
      setDocuments(data)
    } catch (e) {
      showErrorToast(
        e instanceof Error ? e.message : 'Failed to load documents',
      )
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [quotationId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = documents.filter((doc) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return doc.original_name.toLowerCase().includes(q)
  })

  const { visible: visibleDocuments, hiddenCount, showMore } =
    useVisibleListSlice(filtered, [search, quotationId])

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || readOnly) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadQuotationDocument(quotationId, file)
      }
      await load()
      onHistoryChange?.()
      showSuccessToast(
        files.length === 1 ? 'Document uploaded.' : 'Documents uploaded.',
      )
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAttach = async (doc: DocumentRecord) => {
    setPickerOpen(false)
    try {
      await attachQuotationDocumentFromFileManager(quotationId, doc.id)
      await load()
      onHistoryChange?.()
      showSuccessToast('Document added from File Manager.')
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to attach document')
    }
  }

  const handleDelete = async (doc: DocumentRecord) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Remove document?',
      text: `"${doc.original_name}" will be removed from this quotation only.`,
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#dc3545',
    })
    if (!confirm.isConfirmed) return
    try {
      await deleteQuotationDocument(quotationId, doc.id)
      await load()
      onHistoryChange?.()
      showSuccessToast('Document removed.')
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to remove document')
    }
  }

  const handleDownload = async (doc: DocumentRecord) => {
    try {
      await downloadSecuredFile(doc.url, doc.original_name)
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Download failed')
    }
  }

  return (
    <div className="quotation-documents-panel fm-main">
      <section
        className={`fm-card fm-section${!readOnly && dragOver ? ' border-primary' : ''}`}
        onDragOver={
          readOnly
            ? undefined
            : (e) => {
                e.preventDefault()
                setDragOver(true)
              }
        }
        onDragLeave={readOnly ? undefined : () => setDragOver(false)}
        onDrop={
          readOnly
            ? undefined
            : (e) => {
                e.preventDefault()
                setDragOver(false)
                void handleUpload(e.dataTransfer.files)
              }
        }
      >
        <header className="fm-section-head">
          <h5 className="fm-section-title">Quotation documents</h5>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="position-relative">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem', minWidth: '180px' }}
              />
              <i
                className="bi bi-search position-absolute"
                style={{
                  left: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#98a2ad',
                  fontSize: '0.8rem',
                }}
              />
            </div>
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="fm-action-btn"
                  onClick={() => setPickerOpen(true)}
                >
                  <i className="bi bi-folder2-open me-1" />
                  From File Manager
                </button>
                <button
                  type="button"
                  className="fm-action-btn"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="bi bi-upload me-1" />
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="d-none"
                  onChange={(e) => void handleUpload(e.target.files)}
                />
              </>
            )}
          </div>
        </header>

        {!readOnly && dragOver && (
          <div className="text-center text-primary py-3">
            <i className="bi bi-cloud-arrow-up fs-1" />
            <p className="mb-0 fw-semibold">Drop files here to upload</p>
          </div>
        )}

        <p className="text-muted small mb-3">
          Files here belong to this quotation only and do not appear in File
          Manager.
        </p>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <i className="bi bi-folder2-open fs-1 d-block mb-2" />
            {search
              ? 'No files match your search.'
              : 'No documents yet. Upload files or add them from File Manager.'}
          </div>
        ) : (
          <>
            <div className="fm-recent-scroll">
              <table className="fm-recent-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    {!readOnly && (
                      <th className="fm-recent-actions-th">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="fm-recent-name">
                        <span className="fm-recent-icon">
                          <i
                            className={`bi ${fileIcon(doc.extension, doc.is_image)}`}
                            aria-hidden="true"
                          />
                        </span>
                        <button
                          type="button"
                          className="btn btn-link p-0 border-0 text-start text-dark fm-file-download"
                          onClick={() => void handleDownload(doc)}
                        >
                          {doc.original_name}
                        </button>
                      </div>
                    </td>
                    <td className="fm-recent-size">{formatBytes(doc.size)}</td>
                    <td className="fm-recent-date">
                      {formatDate(doc.created_at)}
                    </td>
                    {!readOnly && (
                      <td className="fm-recent-actions">
                        <button
                          type="button"
                          className="fm-tile-menu"
                          title="Remove"
                          onClick={() => void handleDelete(doc)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListShowMoreFooter hiddenCount={hiddenCount} onShowMore={showMore} />
        </>
        )}
      </section>

      {pickerOpen && (
        <DocumentsModal
          selectionOnly
          onSelect={(doc) => void handleAttach(doc)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

export default QuotationDocumentsPanel
