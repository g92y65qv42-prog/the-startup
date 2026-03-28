import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, GoogleDoc } from '@shared/ipc-channels'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function DocCard({ doc, onOpen }: { doc: GoogleDoc; onOpen: (url: string) => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onClick={() => onOpen(doc.webViewLink)}
    >
      {/* Doc icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: 'rgba(66,133,244,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>
        📄
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 500, color: '#EBEBF5', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {doc.name}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.35)', margin: '2px 0 0' }}>
          {timeAgo(doc.modifiedTime)}
        </p>
      </div>
    </div>
  )
}

export default function DocsPanel() {
  const { invoke } = useIPC()
  const connected = useStore(s => s.integrationStatus.google)

  const [docs, setDocs] = useState<GoogleDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) return
    setLoading(true)
    setError(null)
    invoke<GoogleDoc[]>(IPC.GOOGLE_DOCS_LIST)
      .then(setDocs)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [connected])

  function handleOpen(url: string) {
    invoke(IPC.OPEN_EXTERNAL, url)
  }

  return (
    <PanelWrapper panelId="docs" title="Google Docs">
      {!connected ? (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div style={{ fontSize: 32 }}>📄</div>
          <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', textAlign: 'center' }}>
            Google Drive
          </p>
          <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
            Connect Google in Integrations ↙
          </p>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.3)' }}>
              {docs.length} recent docs
            </span>
            <button
              onClick={() => {
                setLoading(true)
                setError(null)
                invoke<GoogleDoc[]>(IPC.GOOGLE_DOCS_LIST)
                  .then(setDocs)
                  .catch(err => setError((err as Error).message))
                  .finally(() => setLoading(false))
              }}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div style={{
              fontSize: 11, color: '#FF453A', background: 'rgba(255,69,58,0.1)',
              borderRadius: 6, padding: '6px 8px', marginBottom: 8,
            }}>
              {error}
            </div>
          )}

          {!loading && !error && docs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(235,235,245,0.3)', fontSize: 12 }}>
              No recent documents found
            </div>
          )}

          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {docs.map(doc => (
              <DocCard key={doc.id} doc={doc} onOpen={handleOpen} />
            ))}
          </div>
        </div>
      )}
    </PanelWrapper>
  )
}
