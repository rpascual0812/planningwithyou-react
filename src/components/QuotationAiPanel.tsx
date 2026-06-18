import { useCallback, useEffect, useState } from 'react'
import {
  draftQuotationEmailWithAi,
  summarizeQuotationWithAi,
  type QuotationAiEmailDraft,
  type QuotationAiSummary,
} from '../services/aiAssistant'
import { showErrorToast } from '../utils/toast'

type QuotationAiPanelProps = {
  open: boolean
  quotationId: number
  quotationLabel: string
  onClose: () => void
  onUseEmailDraft: (draft: QuotationAiEmailDraft) => void
}

type Tab = 'summary' | 'email'

export default function QuotationAiPanel({
  open,
  quotationId,
  quotationLabel,
  onClose,
  onUseEmailDraft,
}: QuotationAiPanelProps) {
  const [tab, setTab] = useState<Tab>('summary')
  const [prompt, setPrompt] = useState('')
  const [summary, setSummary] = useState<QuotationAiSummary | null>(null)
  const [emailDraft, setEmailDraft] = useState<QuotationAiEmailDraft | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab('summary')
    setPrompt('')
    setSummary(null)
    setEmailDraft(null)
    setLoading(false)
  }, [open, quotationId])

  const runSummary = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await summarizeQuotationWithAi(quotationId, prompt))
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Summary failed')
    } finally {
      setLoading(false)
    }
  }, [quotationId, prompt])

  const runEmailDraft = useCallback(async () => {
    setLoading(true)
    try {
      setEmailDraft(await draftQuotationEmailWithAi(quotationId, prompt))
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Email draft failed')
    } finally {
      setLoading(false)
    }
  }, [quotationId, prompt])

  if (!open) return null

  return (
    <>
      <div
        className="modal-backdrop fade show quotation-ai-panel-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="modal fade show quotation-ai-panel d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-ai-panel-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title" id="quotation-ai-panel-title">
                  AI Assistant
                </h5>
                <p className="text-muted small mb-0">{quotationLabel}</p>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <ul className="nav nav-tabs mb-3 quotation-ai-panel__tabs">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link${tab === 'summary' ? ' active' : ''}`}
                    onClick={() => setTab('summary')}
                  >
                    Summary
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link${tab === 'email' ? ' active' : ''}`}
                    onClick={() => setTab('email')}
                  >
                    Draft email
                  </button>
                </li>
              </ul>

              <label className="form-label" htmlFor="quotation-ai-prompt">
                Optional instructions
              </label>
              <textarea
                id="quotation-ai-prompt"
                className="form-control form-control-sm mb-3"
                rows={2}
                placeholder="e.g. Keep it brief, mention the remaining balance, friendly tone…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />

              {tab === 'summary' ? (
                <div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mb-3"
                    disabled={loading}
                    onClick={() => void runSummary()}
                  >
                    {loading ? 'Generating…' : 'Generate summary'}
                  </button>
                  {summary && (
                    <div className="quotation-ai-panel__result">
                      <p className="mb-2">{summary.summary}</p>
                      {summary.highlights.length > 0 && (
                        <ul className="mb-0">
                          {summary.highlights.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mb-3"
                    disabled={loading}
                    onClick={() => void runEmailDraft()}
                  >
                    {loading ? 'Drafting…' : 'Draft email'}
                  </button>
                  {emailDraft && (
                    <div className="quotation-ai-panel__result">
                      <p className="small text-muted mb-1">Subject</p>
                      <p className="fw-semibold">{emailDraft.subject}</p>
                      <p className="small text-muted mb-1 mt-3">Body preview</p>
                      <div
                        className="quotation-ai-panel__email-preview border rounded p-2 small"
                        dangerouslySetInnerHTML={{ __html: emailDraft.body_html }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm mt-3"
                        onClick={() => {
                          onUseEmailDraft(emailDraft)
                          onClose()
                        }}
                      >
                        Use in email composer
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-muted small mt-4 mb-0">
                AI suggestions are drafts only. Review before sending to clients.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
