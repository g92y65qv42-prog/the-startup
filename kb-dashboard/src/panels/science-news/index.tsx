import React, { useEffect, useRef, useState } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, NewsItem, NewsFeed } from '@shared/ipc-channels'

const POLL_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SOURCE_COLORS: Record<string, string> = {
  'NASA': '#0A84FF',
  'arXiv cs.AI': '#32D74B',
  'arXiv Physics': '#FF9F0A',
  'Ars Technica Science': '#FF453A',
}

function SourceBadge({ source }: { source: string | null }) {
  const label = source ?? '?'
  const bg = SOURCE_COLORS[label] ?? '#636366'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: bg, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function NewsCard({ item, onOpen }: { item: NewsItem; onOpen: (url: string) => void }) {
  return (
    <div
      className="group"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        padding: '10px 12px',
        cursor: item.url ? 'pointer' : 'default',
        border: '1px solid rgba(255,255,255,0.04)',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onClick={() => item.url && onOpen(item.url)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <SourceBadge source={item.source} />
        <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.35)', marginLeft: 'auto' }}>
          {timeAgo(item.publishedAt)}
        </span>
      </div>
      <p style={{
        fontSize: 13, fontWeight: 500, color: '#EBEBF5',
        margin: 0, lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {item.title}
      </p>
      {item.summary && (
        <p style={{
          fontSize: 11, color: 'rgba(235,235,245,0.45)', margin: '4px 0 0',
          lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.summary}
        </p>
      )}
    </div>
  )
}

function FeedManager({
  feeds,
  onAdd,
  onRemove,
}: {
  feeds: NewsFeed[]
  onAdd: (url: string, label: string) => void
  onRemove: (id: string) => void
}) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    onAdd(url.trim(), label.trim())
    setUrl('')
    setLabel('')
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 10, padding: '10px 12px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(235,235,245,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        RSS Feeds
      </p>
      <div className="flex flex-col gap-1.5 mb-3">
        {feeds.map(feed => (
          <div key={feed.id} className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: '#EBEBF5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {feed.label ?? feed.url}
            </span>
            <button
              onClick={() => onRemove(feed.id)}
              style={{ background: 'none', border: 'none', color: 'rgba(235,235,245,0.4)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex flex-col gap-1.5">
        <input
          placeholder="Feed URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Label (optional)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={addBtnStyle}>Add Feed</button>
      </form>
    </div>
  )
}

export default function ScienceNewsPanel() {
  const { invoke } = useIPC()
  const newsItems = useStore(s => s.newsItems)
  const newsFeeds = useStore(s => s.newsFeeds)
  const setNewsItems = useStore(s => s.setNewsItems)
  const setNewsFeeds = useStore(s => s.setNewsFeeds)
  const addNewsFeed = useStore(s => s.addNewsFeed)
  const removeNewsFeed = useStore(s => s.removeNewsFeed)

  const [loading, setLoading] = useState(false)
  const [showFeeds, setShowFeeds] = useState(false)
  const [fetchErrors, setFetchErrors] = useState<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function refresh() {
    setLoading(true)
    setFetchErrors([])
    try {
      const result = await invoke<{ count: number; errors: string[] }>(IPC.NEWS_REFRESH)
      if (result?.errors?.length) setFetchErrors(result.errors)
      const items = await invoke<typeof newsItems>(IPC.NEWS_LIST)
      setNewsItems(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load cached items immediately, then refresh in background
    invoke<typeof newsItems>(IPC.NEWS_LIST).then(items => {
      setNewsItems(items)
      if (items.length === 0) refresh()
    })
    invoke<typeof newsFeeds>(IPC.NEWS_FEEDS_LIST).then(setNewsFeeds)

    // Poll every 30 minutes
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function handleOpen(url: string) {
    invoke(IPC.OPEN_EXTERNAL, url)
  }

  async function handleAddFeed(url: string, label: string) {
    const feed = await invoke<NewsFeed>(IPC.NEWS_FEED_ADD, { url, label })
    addNewsFeed(feed)
    refresh()
  }

  async function handleRemoveFeed(id: string) {
    await invoke(IPC.NEWS_FEED_REMOVE, id)
    removeNewsFeed(id)
  }

  return (
    <PanelWrapper panelId="science-news" title="Science News">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              ...chipStyle,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowFeeds(s => !s)}
            style={{ ...chipStyle, background: showFeeds ? 'rgba(10,132,255,0.2)' : 'rgba(255,255,255,0.08)' }}
          >
            Feeds
          </button>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.3)' }}>
          {newsItems.length} items
        </span>
      </div>

      {fetchErrors.length > 0 && (
        <div style={{
          background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.25)',
          borderRadius: 8, padding: '6px 10px', marginBottom: 8,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#FF453A', margin: '0 0 2px' }}>
            Failed to fetch {fetchErrors.length} feed{fetchErrors.length > 1 ? 's' : ''}:
          </p>
          {fetchErrors.map((e, i) => (
            <p key={i} style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)', margin: 0 }}>{e}</p>
          ))}
        </div>
      )}

      {showFeeds && (
        <div className="mb-3">
          <FeedManager feeds={newsFeeds} onAdd={handleAddFeed} onRemove={handleRemoveFeed} />
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100% - 48px)' }}>
        {newsItems.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(235,235,245,0.3)', fontSize: 13 }}>
            No news yet — click Refresh to fetch feeds
          </div>
        )}
        {newsItems.map(item => (
          <NewsCard key={item.id} item={item} onOpen={handleOpen} />
        ))}
      </div>
    </PanelWrapper>
  )
}

const chipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: 'none', borderRadius: 6,
  color: '#fff', fontSize: 11, fontWeight: 500,
  padding: '3px 10px', cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, color: '#fff', fontSize: 12,
  padding: '4px 8px', outline: 'none',
}

const addBtnStyle: React.CSSProperties = {
  background: '#0A84FF', border: 'none', borderRadius: 6,
  color: '#fff', fontSize: 12, fontWeight: 500,
  padding: '4px 10px', cursor: 'pointer',
}
