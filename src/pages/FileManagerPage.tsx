import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  type DocumentRecord,
  type FolderRecord,
  createFolder,
  deleteDocument,
  deleteFolder,
  emptyTrash,
  fetchDocuments,
  fetchFolders,
  moveDocument,
  renameDocument,
  renameFolder,
  restoreDocument,
  restoreFolder,
  uploadDocument,
} from '../services/documents'
import { useFeatureAccess } from '../hooks/useFeatureAccess'

type ViewMode = 'my-cloud' | 'recycle-bin'

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

const FileManagerPage = () => {
  const { canWrite: filesWrite } = useFeatureAccess('file_manager')
  const [viewMode, setViewMode] = useState<ViewMode>('my-cloud')
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [trashDocs, setTrashDocs] = useState<DocumentRecord[]>([])
  const [trashFolders, setTrashFolders] = useState<FolderRecord[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const newFolderRef = useRef<HTMLInputElement>(null)

  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null)
  const [renamingFolderName, setRenamingFolderName] = useState('')
  const renameFolderRef = useRef<HTMLInputElement>(null)

  const [renamingDocId, setRenamingDocId] = useState<number | null>(null)
  const [renamingDocName, setRenamingDocName] = useState('')
  const renameDocRef = useRef<HTMLInputElement>(null)

  const [contextMenu, setContextMenu] = useState<{
    type: 'folder' | 'document'
    id: number
    x: number
    y: number
  } | null>(null)

  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    try {
      const [f, d, tf, td] = await Promise.all([
        fetchFolders(),
        fetchDocuments(
          selectedFolderId
            ? { folder: selectedFolderId, search }
            : { search },
        ),
        fetchFolders(true),
        fetchDocuments({ deleted: true }),
      ])
      setFolders(f)
      setDocuments(d)
      setTrashFolders(tf)
      setTrashDocs(td)
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [selectedFolderId, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (showNewFolder) newFolderRef.current?.focus()
  }, [showNewFolder])

  useEffect(() => {
    if (renamingFolderId != null) renameFolderRef.current?.focus()
  }, [renamingFolderId])

  useEffect(() => {
    if (renamingDocId != null) renameDocRef.current?.focus()
  }, [renamingDocId])

  useEffect(() => {
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    try {
      await createFolder(name)
      setNewFolderName('')
      setShowNewFolder(false)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to create folder', 'error')
    }
  }

  const handleRenameFolder = async (id: number) => {
    const name = renamingFolderName.trim()
    if (!name) return
    try {
      await renameFolder(id, name)
      setRenamingFolderId(null)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to rename folder', 'error')
    }
  }

  const handleDeleteFolder = async (id: number) => {
    const result = await Swal.fire({
      title: 'Delete Folder?',
      text: 'This folder and its documents will be moved to the Recycle Bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d65a5a',
    })
    if (!result.isConfirmed) return
    try {
      await deleteFolder(id)
      if (selectedFolderId === id) setSelectedFolderId(null)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to delete folder', 'error')
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, selectedFolderId ?? undefined)
      }
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to upload file(s)', 'error')
    }
  }

  const handleDeleteDoc = async (id: number) => {
    const result = await Swal.fire({
      title: 'Delete Document?',
      text: 'It will be moved to the Recycle Bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d65a5a',
    })
    if (!result.isConfirmed) return
    try {
      await deleteDocument(id)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to delete document', 'error')
    }
  }

  const handleRenameDoc = async (id: number) => {
    const name = renamingDocName.trim()
    if (!name) return
    try {
      await renameDocument(id, name)
      setRenamingDocId(null)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to rename document', 'error')
    }
  }

  const handleMoveDoc = async (docId: number) => {
    const options = folders.reduce<Record<string, string>>((acc, f) => {
      acc[String(f.id)] = f.name
      return acc
    }, {})
    const { value } = await Swal.fire({
      title: 'Move to Folder',
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'Select a folder',
      showCancelButton: true,
    })
    if (!value) return
    try {
      await moveDocument(docId, Number(value))
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to move document', 'error')
    }
  }

  const handleRestoreDoc = async (id: number) => {
    try {
      await restoreDocument(id)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to restore document', 'error')
    }
  }

  const handleRestoreFolder = async (id: number) => {
    try {
      await restoreFolder(id)
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to restore folder', 'error')
    }
  }

  const handleEmptyTrash = async () => {
    const result = await Swal.fire({
      title: 'Empty Recycle Bin?',
      text: 'All items will be permanently deleted. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Empty Trash',
      confirmButtonColor: '#d65a5a',
    })
    if (!result.isConfirmed) return
    try {
      await emptyTrash()
      await loadData()
    } catch {
      Swal.fire('Error', 'Failed to empty trash', 'error')
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!filesWrite) return
    handleUpload(e.dataTransfer.files)
  }

  const openContext = (
    e: React.MouseEvent,
    type: 'folder' | 'document',
    id: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type, id, x: e.clientX, y: e.clientY })
  }

  const trashCount = trashDocs.length + trashFolders.length
  const selectedFolder = folders.find((f) => f.id === selectedFolderId)
  const displayedDocs = selectedFolderId
    ? documents.filter((d) => d.folder === selectedFolderId)
    : documents

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="fm-layout">
          {/* Sidebar */}
          <aside className="fm-sidebar">
            <section className="fm-card fm-card--padded">
              <h6 className="fm-card-title">My Drive</h6>
              <ul className="fm-nav">
                <li>
                  <button
                    type="button"
                    className={`fm-nav-link${viewMode === 'my-cloud' ? ' is-active' : ''}`}
                    onClick={() => {
                      setViewMode('my-cloud')
                      setSelectedFolderId(null)
                    }}
                  >
                    <i className="bi bi-cloud" aria-hidden="true" />
                    <span className="fm-nav-label">My Cloud</span>
                    <span className="fm-nav-badge">{folders.length}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`fm-nav-link${viewMode === 'recycle-bin' ? ' is-active' : ''}`}
                    onClick={() => setViewMode('recycle-bin')}
                  >
                    <i className="bi bi-trash" aria-hidden="true" />
                    <span className="fm-nav-label">Recycle Bin</span>
                    {trashCount > 0 && (
                      <span className="fm-nav-badge">{trashCount}</span>
                    )}
                  </button>
                </li>
              </ul>

              {viewMode === 'my-cloud' && (
                <>
                  <div className="fm-nav-divider" />
                  <h6
                    className="fm-card-title"
                    style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}
                  >
                    Folders
                  </h6>
                  <ul className="fm-nav">
                    <li>
                      <button
                        type="button"
                        className={`fm-nav-link${selectedFolderId === null ? ' is-active' : ''}`}
                        onClick={() => setSelectedFolderId(null)}
                      >
                        <i className="bi bi-folder" aria-hidden="true" />
                        <span className="fm-nav-label">All Files</span>
                      </button>
                    </li>
                    {folders.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          className={`fm-nav-link${selectedFolderId === f.id ? ' is-active' : ''}`}
                          onClick={() => setSelectedFolderId(f.id)}
                          onContextMenu={(e) => openContext(e, 'folder', f.id)}
                        >
                          <i className="bi bi-folder-fill" aria-hidden="true" />
                          <span className="fm-nav-label">{f.name}</span>
                          <span className="fm-nav-badge">
                            {f.document_count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </aside>

          {/* Main content */}
          <section className="fm-main">
            {viewMode === 'my-cloud' ? (
              <>
                {/* Folders grid */}
                <section className="fm-card fm-section">
                  <header className="fm-section-head">
                    <h5 className="fm-section-title">
                      {selectedFolder
                        ? selectedFolder.name
                        : 'Folders'}
                    </h5>
                    <div className="d-flex gap-2">
                      {selectedFolderId && (
                        <button
                          type="button"
                          className="fm-action-btn"
                          style={{ background: '#6c7682' }}
                          onClick={() => setSelectedFolderId(null)}
                        >
                          <i className="bi bi-arrow-left me-1" />
                          Back
                        </button>
                      )}
                      {!selectedFolderId && filesWrite && (
                        <button
                          type="button"
                          className="fm-action-btn"
                          onClick={() => setShowNewFolder(true)}
                        >
                          <i className="bi bi-plus me-1" />
                          Add Folder
                        </button>
                      )}
                    </div>
                  </header>

                  {!selectedFolderId && (
                    <div className="fm-grid fm-grid--tiles">
                      {showNewFolder && (
                        <article className="fm-tile">
                          <div className="fm-tile-icon fm-tile-icon--folder">
                            <i
                              className="bi bi-folder-plus"
                              aria-hidden="true"
                            />
                          </div>
                          <input
                            ref={newFolderRef}
                            type="text"
                            className="form-control form-control-sm mt-2"
                            placeholder="Folder name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateFolder()
                              if (e.key === 'Escape') {
                                setShowNewFolder(false)
                                setNewFolderName('')
                              }
                            }}
                            onBlur={() => {
                              if (!newFolderName.trim()) {
                                setShowNewFolder(false)
                                setNewFolderName('')
                              }
                            }}
                          />
                          <div className="d-flex gap-1 mt-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={handleCreateFolder}
                            >
                              Create
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => {
                                setShowNewFolder(false)
                                setNewFolderName('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </article>
                      )}
                      {folders.map((folder) =>
                        renamingFolderId === folder.id ? (
                          <article key={folder.id} className="fm-tile">
                            <div className="fm-tile-icon fm-tile-icon--folder">
                              <i
                                className="bi bi-folder-fill"
                                aria-hidden="true"
                              />
                            </div>
                            <input
                              ref={renameFolderRef}
                              type="text"
                              className="form-control form-control-sm mt-2"
                              value={renamingFolderName}
                              onChange={(e) =>
                                setRenamingFolderName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleRenameFolder(folder.id)
                                if (e.key === 'Escape')
                                  setRenamingFolderId(null)
                              }}
                              onBlur={() => setRenamingFolderId(null)}
                            />
                          </article>
                        ) : (
                          <article
                            key={folder.id}
                            className="fm-tile"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedFolderId(folder.id)}
                            onContextMenu={(e) =>
                              openContext(e, 'folder', folder.id)
                            }
                          >
                            <header className="fm-tile-head">
                              <span />
                              <button
                                type="button"
                                className="fm-tile-menu"
                                aria-label="More actions"
                                onClick={(e) =>
                                  openContext(e, 'folder', folder.id)
                                }
                              >
                                <i className="bi bi-three-dots-vertical" />
                              </button>
                            </header>
                            <div className="fm-tile-icon fm-tile-icon--folder">
                              <i
                                className="bi bi-folder-fill"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="fm-tile-name">{folder.name}</div>
                            <div className="fm-folder-meta">
                              <span className="fm-folder-used">
                                {folder.document_count} file
                                {folder.document_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  )}
                </section>

                {/* Documents table */}
                <section
                  className={`fm-card fm-section${dragOver ? ' border-primary' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <header className="fm-section-head">
                    <h5 className="fm-section-title">
                      {selectedFolder
                        ? `Files in ${selectedFolder.name}`
                        : 'All Files'}
                    </h5>
                    <div className="d-flex gap-2 align-items-center">
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
                      {filesWrite && (
                        <button
                          type="button"
                          className="fm-action-btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <i className="bi bi-upload me-1" />
                          Upload
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="d-none"
                        onChange={(e) => handleUpload(e.target.files)}
                      />
                    </div>
                  </header>

                  {dragOver && (
                    <div className="text-center text-primary py-3">
                      <i className="bi bi-cloud-arrow-up fs-1" />
                      <p className="mb-0 fw-semibold">Drop files here to upload</p>
                    </div>
                  )}

                  {loading ? (
                    <div className="text-center py-4">
                      <div
                        className="spinner-border spinner-border-sm"
                        role="status"
                      >
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : displayedDocs.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <i className="bi bi-folder2-open fs-1 d-block mb-2" />
                      No files found.{' '}
                      {!selectedFolderId && !search && 'Upload files to get started.'}
                    </div>
                  ) : (
                    <div className="fm-recent-scroll">
                      <table className="fm-recent-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Folder</th>
                            <th>Size</th>
                            <th>Uploaded</th>
                            <th className="fm-recent-actions-th">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedDocs.map((doc) => (
                            <tr key={doc.id}>
                              <td>
                                {renamingDocId === doc.id ? (
                                  <input
                                    ref={renameDocRef}
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={renamingDocName}
                                    onChange={(e) =>
                                      setRenamingDocName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter')
                                        handleRenameDoc(doc.id)
                                      if (e.key === 'Escape')
                                        setRenamingDocId(null)
                                    }}
                                    onBlur={() => setRenamingDocId(null)}
                                  />
                                ) : (
                                  <div className="fm-recent-name">
                                    <span
                                      className={`fm-recent-icon`}
                                    >
                                      <i
                                        className={`bi ${fileIcon(doc.extension, doc.is_image)}`}
                                        aria-hidden="true"
                                      />
                                    </span>
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-decoration-none text-dark"
                                    >
                                      {doc.original_name}
                                    </a>
                                  </div>
                                )}
                              </td>
                              <td className="fm-recent-size">
                                {doc.folder_name}
                              </td>
                              <td className="fm-recent-size">
                                {formatBytes(doc.size)}
                              </td>
                              <td className="fm-recent-date">
                                {formatDate(doc.created_at)}
                              </td>
                              <td className="fm-recent-actions">
                                <div className="d-flex gap-1 justify-content-end">
                                  <button
                                    type="button"
                                    className="fm-tile-menu"
                                    title="Rename"
                                    onClick={() => {
                                      setRenamingDocId(doc.id)
                                      setRenamingDocName(doc.original_name)
                                    }}
                                  >
                                    <i className="bi bi-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="fm-tile-menu"
                                    title="Move"
                                    onClick={() => handleMoveDoc(doc.id)}
                                  >
                                    <i className="bi bi-folder-symlink" />
                                  </button>
                                  <button
                                    type="button"
                                    className="fm-tile-menu"
                                    title="Delete"
                                    onClick={() => handleDeleteDoc(doc.id)}
                                  >
                                    <i className="bi bi-trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            ) : (
              /* Recycle Bin */
              <section className="fm-card fm-section">
                <header className="fm-section-head">
                  <h5 className="fm-section-title">
                    <i className="bi bi-trash me-2" />
                    Recycle Bin
                  </h5>
                  {trashCount > 0 && filesWrite && (
                    <button
                      type="button"
                      className="fm-action-btn"
                      style={{ background: '#d65a5a' }}
                      onClick={handleEmptyTrash}
                    >
                      <i className="bi bi-trash me-1" />
                      Empty Trash
                    </button>
                  )}
                </header>

                {trashCount === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-trash fs-1 d-block mb-2" />
                    Recycle bin is empty.
                  </div>
                ) : (
                  <>
                    {trashFolders.length > 0 && (
                      <>
                        <h6
                          className="mb-2"
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'var(--brand-navy)',
                          }}
                        >
                          Folders
                        </h6>
                        <div className="fm-grid fm-grid--tiles mb-3">
                          {trashFolders.map((f) => (
                            <article key={f.id} className="fm-tile">
                              <div className="fm-tile-icon fm-tile-icon--folder" style={{ opacity: 0.5 }}>
                                <i
                                  className="bi bi-folder-fill"
                                  aria-hidden="true"
                                />
                              </div>
                              <div className="fm-tile-name">{f.name}</div>
                              <div className="d-flex gap-1 mt-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => handleRestoreFolder(f.id)}
                                >
                                  <i className="bi bi-arrow-counterclockwise me-1" />
                                  Restore
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
                    )}

                    {trashDocs.length > 0 && (
                      <>
                        <h6
                          className="mb-2"
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'var(--brand-navy)',
                          }}
                        >
                          Documents
                        </h6>
                        <div className="fm-recent-scroll">
                          <table className="fm-recent-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Folder</th>
                                <th>Size</th>
                                <th>Deleted</th>
                                <th className="fm-recent-actions-th">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {trashDocs.map((doc) => (
                                <tr key={doc.id}>
                                  <td>
                                    <div className="fm-recent-name">
                                      <span className="fm-recent-icon">
                                        <i
                                          className={`bi ${fileIcon(doc.extension, doc.is_image)}`}
                                          aria-hidden="true"
                                          style={{ opacity: 0.5 }}
                                        />
                                      </span>
                                      <span style={{ opacity: 0.6 }}>
                                        {doc.original_name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="fm-recent-size">
                                    {doc.folder_name}
                                  </td>
                                  <td className="fm-recent-size">
                                    {formatBytes(doc.size)}
                                  </td>
                                  <td className="fm-recent-date">
                                    {doc.deleted_at
                                      ? formatDate(doc.deleted_at)
                                      : '—'}
                                  </td>
                                  <td className="fm-recent-actions">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-success me-1"
                                      title="Restore"
                                      onClick={() =>
                                        handleRestoreDoc(doc.id)
                                      }
                                    >
                                      <i className="bi bi-arrow-counterclockwise" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            )}
          </section>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="dropdown-menu show"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
        >
          {contextMenu.type === 'folder' && (
            <>
              <button
                className="dropdown-item"
                onClick={() => {
                  setSelectedFolderId(contextMenu.id)
                  setContextMenu(null)
                }}
              >
                <i className="bi bi-folder2-open me-2" />
                Open
              </button>
              {filesWrite && (
                <>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      const f = folders.find((x) => x.id === contextMenu.id)
                      if (f) {
                        setRenamingFolderId(f.id)
                        setRenamingFolderName(f.name)
                      }
                      setContextMenu(null)
                    }}
                  >
                    <i className="bi bi-pencil me-2" />
                    Rename
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item text-danger"
                    onClick={() => {
                      handleDeleteFolder(contextMenu.id)
                      setContextMenu(null)
                    }}
                  >
                    <i className="bi bi-trash me-2" />
                    Delete
                  </button>
                </>
              )}
            </>
          )}
          {contextMenu.type === 'document' && (
            <>
              {filesWrite && (
                <>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      const d = documents.find((x) => x.id === contextMenu.id)
                      if (d) {
                        setRenamingDocId(d.id)
                        setRenamingDocName(d.original_name)
                      }
                      setContextMenu(null)
                    }}
                  >
                    <i className="bi bi-pencil me-2" />
                    Rename
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      handleMoveDoc(contextMenu.id)
                      setContextMenu(null)
                    }}
                  >
                    <i className="bi bi-folder-symlink me-2" />
                    Move
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item text-danger"
                    onClick={() => {
                      handleDeleteDoc(contextMenu.id)
                      setContextMenu(null)
                    }}
                  >
                    <i className="bi bi-trash me-2" />
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default FileManagerPage
