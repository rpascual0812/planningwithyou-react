import { useCallback, useEffect, useState } from 'react'
import {
  fetchMarketplaceTemplates,
  type MarketplaceTemplateRecord,
} from '../../../../services/templateStudioApi'
import { useTemplateStudioStore } from '../../store/templateStudioStore'

const MarketplaceModal = () => {
  const open = useTemplateStudioStore((s) => s.marketplaceOpen)
  const setOpen = useTemplateStudioStore((s) => s.setMarketplaceOpen)
  const clearSavedRecord = useTemplateStudioStore((s) => s.clearSavedRecord)

  const [items, setItems] = useState<MarketplaceTemplateRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchMarketplaceTemplates())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const useTemplate = (item: MarketplaceTemplateRecord) => {
    clearSavedRecord()
    useTemplateStudioStore.getState().setDocument(item.document, { pushHistory: false })
    useTemplateStudioStore.getState().updateDocumentMeta({
      title: item.title,
      description: item.description,
    })
    setOpen(false)
  }

  if (!open) return null

  return (
    <>
      <div className="modal fade show d-block ts-modal" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Template marketplace</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setOpen(false)} />
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              {loading && <div className="text-muted">Loading catalog…</div>}
              {!loading && items.length === 0 && (
                <div className="text-muted small">No marketplace templates yet.</div>
              )}
              <div className="row g-3 ts-marketplace-grid">
                {items.map((item) => (
                  <div key={item.id} className="col-md-6">
                    <div className="ts-marketplace-card h-100">
                      <div className="ts-marketplace-card-body">
                        <h6 className="ts-marketplace-card-title">{item.title}</h6>
                        <p className="ts-marketplace-card-desc">{item.description}</p>
                        <span className="ts-marketplace-badge">{item.category}</span>
                        {item.marketplace_preview_url ? (
                          <div className="mt-2">
                            <a
                              href={item.marketplace_preview_url}
                              target="_blank"
                              rel="noreferrer"
                              className="small"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View reference site
                            </a>
                          </div>
                        ) : null}
                      </div>
                      <div className="ts-marketplace-card-footer">
                        <button
                          type="button"
                          className="ts-btn ts-btn--primary"
                          onClick={() => useTemplate(item)}
                        >
                          Use template
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" onClick={() => setOpen(false)} />
    </>
  )
}

export default MarketplaceModal
