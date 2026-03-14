import React, { useEffect, useCallback } from 'react'
import { PanelWrapper } from '../_base/PanelWrapper'
import { useStore } from '@/store'
import { useIPC } from '@/hooks/useIPC'
import { IPC, NewsItem } from '@shared/ipc-channels'

const REFRESH_INTERVAL_MS = 30 * 60 * 1000

const SOURCE_COLORS: Record<string, string> = {
  'NASA': '#0A84FF',
  'arXiv cs.AI': '#32D74B',
  'arXiv Physics': '#5E5CE6',
  'Nature': '#FF9F0A',
  'Ars Technica Science': '#FF453A'
}

function sourceBadgeColor(source: string | null) {
  if (!source) return 'rgba(235,235,245,0.2)'
  return SOURCE_COLORS[source] ?? '#0A84FF'
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ScienceNewsPanel() {
  const { invoke } = useIPC()
  const newsItems = useStore(s => s.newsItems)
  const newsLoading = useStore(s => s.newsLoading)
  const setNews = useStore(s => s.setNews)
  const setNewsLoading = useStore(s => s.setNewsLoading)

  const load = useCallback(async () => {
    const items = await invoke<NewsItem[]>(IPC.NEWS_LIST)
    setNews(items)
  }, [])

  const refresh = useCallback(async () => {
    setNewsLoading(true)
    try {
      await invoke(IPC.NEWS_REFRESH)
      await load()
    } finally {
      setNewsLoading(false)
    }
  }, [load])

  useEffect(() => {
    load()
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <PanelWrapper panelId="science-news" title="Science News">
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.3)' }}>
          {newsItems.length} articles
        </span>
        <button
          onClick={refresh}
          disabled={newsLoading}
          style={{
            background: 'none',
            border: 'none',
            color: newsLoading ? 'rgba(235,235,245,0.3)' : 'rgba(235,235,245,0.5)',
            fontSize: 11,
            cursor: newsLoading ? 'default' : 'pointer',
            padding: '2px 4px'
          }}
        >
          {newsLoading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div
        className="flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: 'calc(100% - 32px)' }}
      >
        {newsItems.length === 0 && !newsLoading && (
          <div className="flex flex-col items-center justify-center" style={{ padding: '32px 0', gap: 8 }}>
            <div style={{ fontSize: 28 }}>🔭</div>
            <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.4)', textAlign: 'center' }}>
              No articles cached yet
            </p>
            <button
              onClick={refresh}
              style={{
                background: '#0A84FF',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                padding: '4px 12px',
                cursor: 'pointer'
              }}
            >
              Fetch now
            </button>
          </div>
        )}

        {newsItems.map(item => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </PanelWrapper>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  const badgeColor = sourceBadgeColor(item.source)

  function openLink() {
    if (item.url) window.electronAPI.invoke('shell:open-external', item.url)
  }

  return (
    <div
      className="rounded-xl p-2.5 flex flex-col gap-1.5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: item.url ? 'pointer' : 'default'
      }}
      onClick={item.url ? openLink : undefined}
    >
      <div className="flex items-center gap-2">
        {item.source && (
          <span
            style={{
              background: badgeColor,
              borderRadius: 4,
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 5px',
              flexShrink: 0
            }}
          >
            {item.source}
          </span>
        )}
        {item.publishedAt && (
          <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.3)', marginLeft: 'auto' }}>
            {timeAgo(item.publishedAt)}
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: '#EBEBF5',
          lineHeight: 1.4,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {item.title}
      </p>

      {item.summary && (
        <p
          style={{
            fontSize: 12,
            color: 'rgba(235,235,245,0.45)',
            lineHeight: 1.4,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {item.summary}
        </p>
      )}

      {item.url && (
        <span style={{ fontSize: 11, color: '#0A84FF', marginTop: 2 }}>
          Open →
        </span>
      )}
    </div>
  )
}
