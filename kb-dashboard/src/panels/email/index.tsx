import React, { useEffect, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, OutlookMessage, OutlookMessages } from '@shared/ipc-channels'

type Tab = 'inbox' | 'flagged'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function MessageCard({ msg, onOpen }: { msg: OutlookMessage; onOpen: (url: string) => void }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 8,
        border: `1px solid ${msg.isRead ? 'rgba(255,255,255,0.04)' : 'rgba(10,132,255,0.2)'}`,
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onClick={() => msg.webLink && onOpen(msg.webLink)}
    >
      <div className="flex items-center gap-2 mb-1">
        {!msg.isRead && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A84FF', flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 12, fontWeight: msg.isRead ? 400 : 600,
          color: msg.isRead ? 'rgba(235,235,245,0.6)' : '#EBEBF5',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {msg.fromName || msg.fromEmail}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.3)', flexShrink: 0 }}>
          {timeAgo(msg.receivedAt)}
        </span>
      </div>
      <p style={{
        fontSize: 13, fontWeight: msg.isRead ? 400 : 500, color: '#EBEBF5',
        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {msg.subject}
      </p>
      {msg.preview && (
        <p style={{
          fontSize: 11, color: 'rgba(235,235,245,0.4)', margin: '2px 0 0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {msg.preview}
        </p>
      )}
    </div>
  )
}

export default function EmailPanel() {
  const { invoke } = useIPC()
  const connected = useStore(s => s.integrationStatus.microsoft)

  const [messages, setMessages] = useState<OutlookMessages>({ inbox: [], flagged: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('inbox')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await invoke<OutlookMessages>(IPC.OUTLOOK_MESSAGES_LIST)
      setMessages(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!connected) return
    load()
    // Refresh every 5 minutes
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [connected])

  function handleOpen(url: string) {
    invoke(IPC.OPEN_EXTERNAL, url)
  }

  const visibleMessages = activeTab === 'inbox' ? messages.inbox : messages.flagged
  const unreadCount = messages.inbox.filter(m => !m.isRead).length

  return (
    <PanelWrapper panelId="email" title="Outlook">
      {!connected ? (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div style={{ fontSize: 32 }}>✉️</div>
          <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', textAlign: 'center' }}>
            Outlook / Microsoft 365
          </p>
          <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.3)', textAlign: 'center' }}>
            Connect Microsoft in Integrations ↙
          </p>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={() => setActiveTab('inbox')}
              style={{
                ...tabStyle,
                background: activeTab === 'inbox' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'inbox' ? '#EBEBF5' : 'rgba(235,235,245,0.45)',
              }}
            >
              Inbox {unreadCount > 0 && (
                <span style={{
                  marginLeft: 4, background: '#0A84FF', borderRadius: 8,
                  fontSize: 10, padding: '0 5px', color: '#fff', fontWeight: 700,
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              style={{
                ...tabStyle,
                background: activeTab === 'flagged' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'flagged' ? '#EBEBF5' : 'rgba(235,235,245,0.45)',
              }}
            >
              🚩 Flagged {messages.flagged.length > 0 && (
                <span style={{
                  marginLeft: 4, background: '#FF9F0A', borderRadius: 8,
                  fontSize: 10, padding: '0 5px', color: '#fff', fontWeight: 700,
                }}>
                  {messages.flagged.length}
                </span>
              )}
            </button>
            <button
              onClick={load}
              disabled={loading}
              style={{
                marginLeft: 'auto',
                background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? '…' : '↻'}
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

          {!loading && !error && visibleMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(235,235,245,0.3)', fontSize: 12 }}>
              {activeTab === 'inbox' ? 'Inbox is empty' : 'No flagged messages'}
            </div>
          )}

          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {visibleMessages.map(msg => (
              <MessageCard key={msg.id} msg={msg} onOpen={handleOpen} />
            ))}
          </div>
        </div>
      )}
    </PanelWrapper>
  )
}

const tabStyle: React.CSSProperties = {
  border: 'none', borderRadius: 6,
  fontSize: 11, fontWeight: 500,
  padding: '3px 8px', cursor: 'pointer',
  transition: 'all 0.15s ease', display: 'flex', alignItems: 'center',
}
